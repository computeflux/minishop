import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, Coins, Loader2 } from "lucide-react";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { SectionLabel } from "@/ui/kit";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { GatewayContractApi } from "@/contracts/tee/gateway";
import type { WithdrawApply } from "@/contracts/tee/types/gateway";
import {
  getRateSol,
  getErc20DetailsBatch,
  getPendingWithdrawalSol,
  claimWithdrawalSol,
  cancelWithdrawalSol,
} from "@/contracts/evm/tokenSol";
import { useWeb3Wallet } from "@/shared/hooks/useWeb3Wallet";
import { useProviderCredit } from "@/hooks/useShops";
import { useRechargeTokens } from "@/hooks/useRecharge";
import { polkadotHubTestnet } from "@/shared/config/wagmi";
import { formatCredits, formatTokenAmount } from "@/shared/utils";
import { toast } from "@/shared/lib/toast";
import { cn } from "@/shared/lib/utils";

const CHAIN_ID = polkadotHubTestnet.id;
const HISTORY_LIMIT = 20;

function generateNonce(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function creditValue(credit: unknown): string {
  return typeof credit === "string" ? credit : "0";
}

const STATUS_CLS: Record<number, string> = {
  0: "border-white/25 text-white",
  1: "border-white/10 text-white/40",
  2: "border-white/25 text-white",
};

/**
 * 提现 — 店铺余额度提现到钱包 + 提现历史。
 * 参考 dapp WithdrawSection：native/ERC20 选择、链上汇率换算、
 * pending 记录支持 claim / cancel。
 */
export function WithdrawCard({
  id,
  address,
  index,
}: {
  id: number;
  address: string | undefined;
  /** SectionLabel 编号；传 undefined 隐藏 */
  index?: string;
}) {
  const wallet = useWeb3Wallet();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [tokenId, setTokenId] = useState("native");
  const { t } = useTranslation();

  const { data: creditRaw } = useProviderCredit(id);
  const credit = creditRaw ? Number(String(creditRaw).replace(/,/g, "")) : 0;

  // native 汇率
  const { data: nativeRate } = useQuery({
    queryKey: ["minishop", "withdrawRate", CHAIN_ID],
    queryFn: () =>
      wallet?.provider ? getRateSol(wallet.provider, CHAIN_ID) : 0n,
    enabled: Boolean(wallet?.provider),
  });

  // ERC20 列表 + 元数据
  const { data: erc20List } = useRechargeTokens(wallet?.provider);
  const erc20Tokens = useMemo(
    () => (erc20List ?? []).filter((t) => t.active).map((t) => t.address),
    [erc20List]
  );
  const { data: erc20Details } = useQuery({
    queryKey: ["minishop", "erc20Details", erc20Tokens.join(","), address],
    queryFn: async () => {
      if (!wallet?.provider || !address || erc20Tokens.length === 0) return {};
      return getErc20DetailsBatch(
        wallet.provider,
        erc20Tokens,
        address as `0x${string}`,
        CHAIN_ID
      );
    },
    enabled: Boolean(wallet?.provider && address && erc20Tokens.length > 0),
  });

  const selected = useMemo(() => {
    if (tokenId === "native") {
      return {
        id: "native",
        isNative: true,
        symbol: polkadotHubTestnet.nativeCurrency.symbol,
        decimals: polkadotHubTestnet.nativeCurrency.decimals,
        rate: nativeRate ?? 0n,
        unit: 10n ** BigInt(polkadotHubTestnet.nativeCurrency.decimals),
      };
    }
    const cfg = (erc20List ?? []).find(
      (t) => t.address.toLowerCase() === tokenId.toLowerCase()
    );
    const detail = erc20Details?.[tokenId.toLowerCase()];
    return {
      id: tokenId,
      isNative: false,
      symbol:
        detail?.symbol ?? `${tokenId.slice(0, 6)}...${tokenId.slice(-4)}`,
      decimals: detail?.decimals ?? 18,
      rate: cfg?.rate ?? 0n,
      unit: cfg?.unit ?? 1n,
    };
  }, [tokenId, nativeRate, erc20List, erc20Details]);

  const pointsNum = useMemo(() => {
    const n = Number(amount);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 1e6) : 0;
  }, [amount]);

  const tokenAmount = useMemo(() => {
    if (pointsNum <= 0 || !selected.rate || selected.rate === 0n) return null;
    return (BigInt(pointsNum) * selected.unit) / selected.rate;
  }, [pointsNum, selected]);

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      if (!wallet) throw new Error(i18n.t("minishop.common.connect_first", "请先连接钱包"));
      if (!pointsNum) throw new Error(i18n.t("minishop.withdraw.amount_required", "请输入有效金额"));
      const nonce = generateNonce();
      const token = selected.isNative ? selected.symbol : selected.id;
      return GatewayContractApi.applyWithdraw(
        wallet,
        CHAIN_ID,
        token,
        id,
        pointsNum,
        nonce
      );
    },
    onSuccess: () => {
      toast.success(i18n.t("minishop.withdraw.submitted", "提现已提交，通常 2-5 分钟到账。"));
      setAmount("");
      queryClient.invalidateQueries({
        queryKey: ["minishop", "providerCredit", id],
      });
      queryClient.invalidateQueries({
        queryKey: ["minishop", "withdrawals", address],
      });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : i18n.t("minishop.withdraw.failed", "提现失败")),
  });

  // 提现历史
  const { data: withdrawalsRaw, isLoading: whLoading } = useQuery({
    queryKey: ["minishop", "withdrawals", address],
    queryFn: () =>
      address
        ? GatewayContractApi.withdrawalsByUser(address, 0, HISTORY_LIMIT)
        : Promise.resolve([]),
    enabled: Boolean(address),
  });
  const withdrawals = withdrawalsRaw ? [...withdrawalsRaw].reverse() : [];

  const claimMutation = useMutation({
    mutationFn: (nonce: string) => {
      if (!wallet) throw new Error("请先连接钱包");
      return claimWithdrawalSol(
        wallet.provider,
        CHAIN_ID,
        BigInt(nonce),
        wallet.address
      );
    },
    onSuccess: () => {
      toast.success(i18n.t("minishop.withdraw.claimed", "领取成功")),
      queryClient.invalidateQueries({
        queryKey: ["minishop", "withdrawals", address],
      });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : i18n.t("minishop.withdraw.claim_failed", "领取失败")),
  });

  const cancelMutation = useMutation({
    mutationFn: (nonce: string) => {
      if (!wallet) throw new Error("请先连接钱包");
      return cancelWithdrawalSol(
        wallet.provider,
        CHAIN_ID,
        BigInt(nonce),
        wallet.address
      );
    },
    onSuccess: () => {
      toast.success(i18n.t("minishop.withdraw.cancelled", "已取消")),
      queryClient.invalidateQueries({
        queryKey: ["minishop", "withdrawals", address],
      });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : i18n.t("minishop.withdraw.cancel_failed", "取消失败")),
  });

  const busy = claimMutation.isPending || cancelMutation.isPending;

  return (
    <div className="border border-white/10 p-6">
      <SectionLabel index={index} title={t("minishop.withdraw.title", "提现")} />
      <p className="mt-2 text-[13px] leading-relaxed text-white/45">
        {t("minishop.withdraw.desc", "将店铺余额度提现到钱包，按链上汇率兑换。")}
      </p>

      {/* 可用余额度 */}
      <div className="mt-4 flex items-baseline gap-2 border border-white/10 bg-white/[0.02] px-4 py-3">
        <span className="text-[11px] text-white/40">{t("minishop.withdraw.available_quota", "可用余额度")}</span>
        <span className="num text-lg text-white">
          ${formatCredits(credit)}
        </span>
      </div>

      {/* 代币选择 */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={tokenId === "native" ? "default" : "outline"}
          onClick={() => setTokenId("native")}
        >
          <Coins className="size-3.5" />
          {polkadotHubTestnet.nativeCurrency.symbol}
        </Button>
        {(erc20List ?? [])
          .filter((t) => t.active)
          .map((tk) => {
            const detail = erc20Details?.[tk.address.toLowerCase()];
            const isSelected =
              tokenId.toLowerCase() === tk.address.toLowerCase();
            return (
              <Button
                key={tk.address}
                type="button"
                size="sm"
                variant={isSelected ? "default" : "outline"}
                onClick={() => setTokenId(tk.address)}
              >
                <Coins className="size-3.5" />
                {detail?.symbol ??
                  `${tk.address.slice(0, 6)}...${tk.address.slice(-4)}`}
              </Button>
            );
          })}
      </div>

      {/* 金额 + 提交 */}
      <div className="mt-4 flex items-end gap-3">
        <div className="flex-1">
          <div className="mb-1.5 text-[11px] text-white/40">
            {t("minishop.withdraw.amount_label", "提现金额（积分）— 可用: ")}${formatCredits(credit)}
          </div>
          <Input
            type="number"
            placeholder="0"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-9 text-[13px]"
          />
        </div>
        <Button
          size="sm"
          className="h-9"
          disabled={!amount.trim() || withdrawMutation.isPending}
          onClick={() => withdrawMutation.mutate()}
        >
          {withdrawMutation.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <ArrowDown className="size-3.5" />
          )}
          {t("minishop.withdraw.title", "提现")}
        </Button>
      </div>

      {/* 换算信息 */}
      {pointsNum > 0 && tokenAmount !== null ? (
        <div className="mt-4 space-y-2 border border-white/10 bg-white/[0.02] px-4 py-3 text-[12px]">
          <div className="flex items-center justify-between">
            <span className="text-white/40">{t("minishop.withdraw.rate", "汇率")}</span>
            <span className="text-white/75">
              {selected.rate && selected.rate !== 0n
                ? `1 ${selected.symbol} = $${formatCredits(
                    Number(selected.rate)
                  )}`
                : "—"}
            </span>
          </div>
          <div className="border-t border-white/10" />
          <div className="flex items-center justify-between">
            <span className="text-white/40">{t("minishop.withdraw.withdraw_amount", "提现金额")}</span>
            <span className="num text-white/85">
              ${formatCredits(pointsNum)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/40">{t("minishop.withdraw.expected_receive", "预计收到")}</span>
            <span className="num text-white">
              {formatTokenAmount(tokenAmount, selected.decimals)}{" "}
              {selected.symbol}
            </span>
          </div>
        </div>
      ) : null}

      {/* 提现历史 */}
      <div className="mt-6 border-t border-white/10 pt-4">
        <SectionLabel title={t("minishop.withdraw.history", "提现历史")} count={withdrawals.length} />
        <div className="mt-3">
          {whLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-4 animate-spin text-white/40" />
            </div>
          ) : withdrawals.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-white/35">
              {t("minishop.withdraw.no_records", "暂无提现记录")}
            </p>
          ) : (
            <div className="border border-white/10">
              {withdrawals.map((w, i) => (
                <WithdrawRow
                  key={`${w.Nonce}-${i}`}
                  w={w}
                  last={i === withdrawals.length - 1}
                  busy={busy}
                  claiming={
                    claimMutation.isPending &&
                    claimMutation.variables === w.Nonce
                  }
                  cancelling={
                    cancelMutation.isPending &&
                    cancelMutation.variables === w.Nonce
                  }
                  onClaim={() => claimMutation.mutate(w.Nonce)}
                  onCancel={() => cancelMutation.mutate(w.Nonce)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── 单条提现记录 — pending 查链上状态，支持领取 / 取消 ─────────────── */

function WithdrawRow({
  w,
  last,
  busy,
  claiming,
  cancelling,
  onClaim,
  onCancel,
}: {
  w: WithdrawApply;
  last: boolean;
  busy: boolean;
  claiming: boolean;
  cancelling: boolean;
  onClaim: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const wallet = useWeb3Wallet();
  const { data: pending, isLoading } = useQuery({
    queryKey: ["minishop", "pendingWithdrawal", w.ChainID, w.Nonce],
    queryFn: () =>
      wallet?.provider
        ? getPendingWithdrawalSol(
            wallet.provider,
            w.ChainID,
            BigInt(w.Nonce)
          )
        : Promise.resolve(null),
    enabled: w.Status === 0 && Boolean(wallet?.provider),
  });

  const statusLabel =
    w.Status === 0
      ? t("minishop.withdraw.status_pending", "待处理")
      : w.Status === 1
      ? t("minishop.withdraw.status_cancelled", "已取消")
      : w.Status === 2
      ? t("minishop.withdraw.status_done", "已完成")
      : `${t("minishop.withdraw.status_unknown", "未知")} (${w.Status})`;
  const statusCls = STATUS_CLS[w.Status] ?? "border-white/10 text-white/40";
  const tokenDisplay =
    w.Contract && w.Contract.startsWith("0x")
      ? `${w.Contract.slice(0, 6)}...${w.Contract.slice(-4)}`
      : w.Contract || "—";

  return (
    <div
      className={
        "flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3" +
        (last ? "" : " border-b border-white/10")
      }
    >
      <div className="min-w-0 flex-1">
        <div className="num text-[13px] text-white">
          ${formatCredits(creditValue(w.Credit))}
        </div>
        <div className="num mt-0.5 truncate text-[11px] text-white/35">
          {t("minishop.withdraw.chain", "链")} {w.ChainID} · {tokenDisplay} · {w.Nonce.slice(0, 8)}…
        </div>
      </div>
      <span
        className={cn("shrink-0 border px-2 py-0.5 text-[11px]", statusCls)}
      >
        {statusLabel}
      </span>
      {w.Status === 0 ? (
        isLoading ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-white/40" />
        ) : pending != null ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              size="xs"
              variant="outline"
              disabled={busy}
              onClick={onClaim}
            >
              {claiming ? (
                <Loader2 className="size-3 animate-spin" />
              ) : null}
              {t("minishop.withdraw.claim", "领取")}
            </Button>
            <Button
              size="xs"
              variant="ghost"
              disabled={busy}
              onClick={onCancel}
            >
              {cancelling ? (
                <Loader2 className="size-3 animate-spin" />
              ) : null}
              {t("minishop.withdraw.cancel", "取消")}
            </Button>
          </div>
        ) : (
          <span className="shrink-0 text-[10px] text-white/30">
            {t("minishop.withdraw.chain_processed", "链上已处理")}
          </span>
        )
      ) : null}
    </div>
  );
}
