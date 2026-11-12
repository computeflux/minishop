import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
  startTransition,
  Fragment,
} from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/ui/dialog";
import {
  formatTokenAmount,
  formatCredits,
  showError,
  showInfo,
  parseChainId,
} from "@/shared/utils";
import { pushToast } from "@/shared/lib/toast";
import { useConnectedNativeToken } from "@/shared/hooks";
import { useWeb3Auth } from "@wetee/web3auth/react";
import {
  getRateSol,
  rechargeSol,
  getErc20Allowance,
  approveErc20Max,
  rechargeErc20,
  getErc20BalancesBatch,
  getContractAddress,
  waitForTxReceipt,
  describeEvmError,
  getRechargeFeeRateSol,
} from "@/contracts/evm/tokenSol";
import type { EIP1193Provider } from "@/contracts/tee/types";
import type { Erc20TokenConfig } from "@/contracts/evm/tokenSol";
import {
  fetchErc20List as fetchErc20ListApi,
} from "@/shared/api/erc20";
import { fetchErc20BalancesFromBlockscout } from "@/shared/api/blockscout";
import {
  Loader2,
  Zap,
  Coins,
  CircleDollarSign,
  AlertTriangle,
  Wallet,
  Check,
  X,
} from "lucide-react";
import QRCode from "qrcode";
import { newIdemKey } from "@computeflux/c2c-sdk";
import { cn } from "@/shared/lib/utils";
import { useRechargeStore } from "@/shared/stores/recharge";
import {
  createC2cOrder,
  fetchC2cOrderStatus,
  isTerminalStage,
  type C2cOrderStep,
} from "@/shared/api/c2c";

function StripeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        fill="currentColor"
        d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409c0-.831.683-1.305 1.901-1.305c2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0C9.667 0 7.589.654 6.104 1.872C4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219c2.585.92 3.445 1.574 3.445 2.583c0 .98-.84 1.545-2.354 1.545c-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813c1.664-1.305 2.525-3.236 2.525-5.732c0-4.128-2.524-5.851-6.594-7.305z"
      />
    </svg>
  );
}

function AlipayIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        fill="currentColor"
        d="M19.695 15.07c3.426 1.158 4.203 1.22 4.203 1.22V3.846c0-2.124-1.705-3.845-3.81-3.845H3.914C1.808.001.102 1.722.102 3.846v16.31c0 2.123 1.706 3.845 3.813 3.845h16.173c2.105 0 3.81-1.722 3.81-3.845v-.157s-6.19-2.602-9.315-4.119c-2.096 2.602-4.8 4.181-7.607 4.181c-4.75 0-6.361-4.19-4.112-6.949c.49-.602 1.324-1.175 2.617-1.497c2.025-.502 5.247.313 8.266 1.317a16.8 16.8 0 0 0 1.341-3.302H5.781v-.952h4.799V6.975H4.77v-.953h5.81V3.591s0-.409.411-.409h2.347v2.84h5.744v.951h-5.744v1.704h4.69a19.5 19.5 0 0 1-1.986 5.06c1.424.52 2.702 1.011 3.654 1.333m-13.81-2.032c-.596.06-1.71.325-2.321.869c-1.83 1.608-.735 4.55 2.968 4.55c2.151 0 4.301-1.388 5.99-3.61c-2.403-1.182-4.438-2.028-6.637-1.809"
      />
    </svg>
  );
}

function WechatPayIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        fill="currentColor"
        d="M9.271 14.669a.66.66 0 0 1-.88-.269l-.043-.095l-1.818-3.998a.5.5 0 0 1 0-.146a.327.327 0 0 1 .335-.327a.3.3 0 0 1 .196.066l2.18 1.527a1 1 0 0 0 .546.167a.9.9 0 0 0 .342-.066l10.047-4.5a10.73 10.73 0 0 0-8.171-3.526C6.479 3.502 2 7.232 2 11.87a7.83 7.83 0 0 0 3.46 6.296a.66.66 0 0 1 .24.727l-.45 1.701a1 1 0 0 0-.051.24a.327.327 0 0 0 .334.334a.4.4 0 0 0 .19-.058l2.18-1.265c.16-.098.343-.151.53-.152q.15 0 .292.043c1.062.3 2.16.452 3.264.45c5.525 0 10.011-3.729 10.011-8.33a7.23 7.23 0 0 0-1.098-3.883L9.351 14.625z"
      />
    </svg>
  );
}

type RechargeTab = "native" | "erc20" | "c2c";

interface RechargeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TabButtonProps {
  id: RechargeTab;
  label: string;
  icon: React.ElementType;
  active: boolean;
  onClick: (id: RechargeTab) => void;
}

function TabButton({ id, label, icon: Icon, active, onClick }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={cn(
        "flex items-center justify-center gap-2 px-2 py-2.5 rounded-lg text-[13px] font-medium transition-all border w-full",
        active
          ? "bg-foreground text-background border-foreground"
          : "bg-transparent text-subtle border-foreground/10 hover:border-foreground/20 hover:text-foreground/70"
      )}
    >
      <Icon className="size-4 shrink-0" />
      {label}
    </button>
  );
}

/**
 * 步骤文案的 i18n key（后端 `label` 只有中文，这里按 step.key 取译文，
 * 并用 stage 区分变体：awaiting_review 的首两步是「提交凭证 / 人工审核」，
 * 结果步在终态时为「成功 / 失败 / 已取消」）。未知 key 返回 null → 直接用后端 label。
 */
function c2cStepI18nKey(step: C2cOrderStep, stage: string): string | null {
  switch (step.key) {
    case "scan_pay":
      return stage === "awaiting_review"
        ? "recharge.c2c.step.submit_evidence"
        : "recharge.c2c.step.scan_pay";
    case "chain_release":
      return stage === "awaiting_review"
        ? "recharge.c2c.step.manual_review"
        : "recharge.c2c.step.chain_release";
    case "result":
      if (stage === "completed") return "recharge.c2c.step.success";
      if (stage === "failed") return "recharge.c2c.step.failed";
      if (stage === "canceled") return "recharge.c2c.step.canceled";
      return "recharge.c2c.step.result";
    default:
      return null;
  }
}

type InjectedEthereum = {
  isMetaMask?: boolean;
  chainId?: string;
  networkVersion?: string;
  selectedAddress?: string | null;
  providers?: Array<{ isMetaMask?: boolean; chainId?: string }>;
};

/**
 * 打印钱包/链上下文，用于对比 MetaMask 与邮箱钱包（嵌入式钱包）的差异：
 * 注入钱包类型、provider 实际链、账户、原生余额。
 */
async function logWalletContext(
  tag: string,
  provider: EIP1193Provider,
  context: Record<string, unknown>
) {
  const injected = (window as unknown as { ethereum?: InjectedEthereum })
    .ethereum;
  console.log(`[Recharge][${tag}] context`, {
    ...context,
    injected: injected
      ? {
          isMetaMask: injected.isMetaMask,
          chainId: injected.chainId,
          networkVersion: injected.networkVersion,
          selectedAddress: injected.selectedAddress,
          providers: injected.providers?.map((p) => ({
            isMetaMask: p.isMetaMask,
            chainId: p.chainId,
          })),
        }
      : null,
  });

  const state: Record<string, unknown> = {};
  try {
    state.eth_chainId = await provider.request({ method: "eth_chainId" });
  } catch (err) {
    state.eth_chainId = { error: describeEvmError(err) };
  }
  try {
    state.eth_accounts = await provider.request({ method: "eth_accounts" });
  } catch (err) {
    state.eth_accounts = { error: describeEvmError(err) };
  }
  const from = context.address;
  if (typeof from === "string") {
    try {
      state.eth_getBalance = await provider.request({
        method: "eth_getBalance",
        params: [from, "latest"],
      });
    } catch (err) {
      state.eth_getBalance = { error: describeEvmError(err) };
    }
  }
  console.log(`[Recharge][${tag}] provider state`, state);
}

/** 单个步骤节点：圆圈图标 + 文案（配色走项目语义色） */
function C2cStepNode({ step, stage }: { step: C2cOrderStep; stage: string }) {
  const { t } = useTranslation();
  const { state } = step;
  const labelKey = c2cStepI18nKey(step, stage);
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
      <div
        className={cn(
          "flex size-7 items-center justify-center rounded-full border transition-colors",
          state === "pending" && "border-border bg-muted text-subtle/60",
          state === "doing" && "border-info/40 bg-info/15 text-info",
          state === "done" && "border-success/40 bg-success/15 text-success",
          state === "failed" &&
            "border-destructive/40 bg-destructive/15 text-destructive"
        )}
      >
        {state === "done" ? (
          <Check className="size-3.5" />
        ) : state === "doing" ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : state === "failed" ? (
          <X className="size-3.5" />
        ) : (
          <span className="size-1.5 rounded-full bg-current" />
        )}
      </div>
      {/* 文案优先用前端译文，缺译文时回落到后端给出的 label（如「提交凭证」）；
          break-words 防长单词（如德语 Blockchain-Sync）在窄列里溢到相邻节点 */}
      <span
        className={cn(
          "break-words text-center text-[10px] leading-tight",
          state === "pending" ? "text-subtle" : "text-foreground/80",
          state === "failed" && "text-destructive"
        )}
      >
        {labelKey ? t(labelKey, step.label) : step.label}
      </span>
    </div>
  );
}

/** 订单三阶段进度：横向圆圈节点 + 连接线（无外框，嵌入二维码卡片底部） */
function C2cOrderSteps({
  steps,
  stage,
}: {
  steps: C2cOrderStep[];
  stage: string;
}) {
  return (
    <div className="flex w-full items-start">
      {steps.map((step, i) => (
        <Fragment key={step.key}>
          {i > 0 && (
            <div
              className={cn(
                "mt-3.5 h-px w-6 shrink-0 rounded-full transition-colors",
                steps[i - 1].state === "done" ? "bg-success/45" : "bg-border"
              )}
            />
          )}
          <C2cStepNode step={step} stage={stage} />
        </Fragment>
      ))}
    </div>
  );
}

// 支付宝/微信：返回二维码；Stripe(link)：展示指令值并跳转新页付款
function C2cPayResult({
  pay,
  onCompleted,
}: {
  pay: {
    orderNo: string;
    buyerAddress: string;
    channel: string;
    instruction: { type: string; value: string };
  };
  /** 链上放款成功（stage=completed）时通知外层：关闭二维码弹窗与充值弹窗 */
  onCompleted?: () => void;
}) {
  const { t } = useTranslation();
  const isLink = pay.instruction.type === "link";
  const [qrUrl, setQrUrl] = useState("");

  // 扫码/跳转支付进度：每 2s 轮询一次（公开接口，按下单地址校验归属），到终态（completed/failed/canceled）停止
  const { data: status } = useQuery({
    queryKey: ["c2c", "orderStatus", pay.orderNo],
    queryFn: () => fetchC2cOrderStatus(pay.orderNo, pay.buyerAddress),
    refetchInterval: (query) =>
      isTerminalStage(query.state.data?.stage) ? false : 2000,
    retry: 1,
  });
  const isSettled = isTerminalStage(status?.stage);

  // 支付完成：只触发一次（ref 防重，避免外层回调身份变化时重复提示）
  const completedNotified = useRef(false);
  useEffect(() => {
    if (status?.stage !== "completed" || completedNotified.current) return;
    completedNotified.current = true;
    onCompleted?.();
  }, [status?.stage, onCompleted]);

  useEffect(() => {
    let active = true;
    if (!isLink && pay.instruction.value) {
      const payload = pay.instruction.value;
      QRCode.toDataURL(payload, {
        width: 480,
        margin: 2,
        errorCorrectionLevel: payload.length > 120 ? "L" : "M",
      })
        .then((url) => { if (active) setQrUrl(url); })
        .catch(() => { if (active) setQrUrl(""); });
    }
    return () => { active = false; };
  }, [isLink, pay.instruction.value]);
  const channelName =
    pay.channel.toLowerCase() === "wechat"
      ? t("recharge.channels.wechat", "微信支付")
      : t("recharge.channels.alipay", "支付宝");
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-[12px] text-subtle">
        {t("recharge.c2c.order", "订单：{{order}}", { order: pay.orderNo })}
      </p>

      {/* 二维码与其三阶段进度合成一张卡片：白底扫码区 + 下沿进度条 */}
      {!isLink ? (
        <div className="w-full overflow-hidden rounded-lg border border-border bg-surface">
          {/* 二维码必须白底才可扫；内层固定尺寸避免异步生成时布局跳动 */}
          <div className="flex justify-center bg-white p-3">
            <div className="flex size-60 items-center justify-center">
              {qrUrl ? (
                <img src={qrUrl} alt="扫码支付二维码" className="size-60" />
              ) : null}
            </div>
          </div>
          {status ? (
            <div className="border-t border-border px-3 py-3">
              <C2cOrderSteps steps={status.steps} stage={status.stage} />
            </div>
          ) : null}
        </div>
      ) : null}

      {!isLink ? (
        <p className="text-[12px] text-subtle">
          {t(
            "recharge.c2c.scan_hint",
            "使用 {{channel}} 扫码支付",
            { channel: channelName }
          )}
        </p>
      ) : (
        <p
          className="text-[11px] text-subtle max-w-full truncate"
          title={pay.instruction.value}
        >
          {pay.instruction.value}
        </p>
      )}

      {!isLink && isSettled ? null : (
        <Button
          size="sm"
          onClick={() => window.open(pay.instruction.value, "_blank")}
          className="h-8 w-60 gap-1.5 text-[12px] font-medium rounded-md"
        >
          <Wallet className="size-3.5" />
          {t("recharge.common.go_pay", "去支付")}
        </Button>
      )}

    </div>
  );
}

export default function RechargeModal({
  open,
  onOpenChange,
}: RechargeModalProps) {
  const { t } = useTranslation();
  const { provider, chainId: w3ChainId, address } = useWeb3Auth();
  const nativeToken = useConnectedNativeToken();

  const chainId = useMemo(() => {
    // 统一走 parseChainId：兼容 0x 前缀十六进制与十进制字符串，
    // 避免 parseInt(…, 16) 把十进制串（如 "137"）误解析成 311 而取错链
    return parseChainId(w3ChainId);
  }, [w3ChainId]);

  const [tab, setTab] = useState<RechargeTab>("erc20");

  // ── Native token state ──
  const [nativePointsInput, setNativePointsInput] = useState("");
  const [nativeRate, setNativeRate] = useState<bigint | null>(null);
  const [nativeRateLoading, setNativeRateLoading] = useState(false);
  // 充值手续费率（基点）：合约会在充值金额上扣除，前端需要反算成支付毛额
  const [rechargeFeeRate, setRechargeFeeRate] = useState<bigint>(0n);
  const [nativeBalance, setNativeBalance] = useState<bigint | null>(null);
  const [nativeBalanceLoading, setNativeBalanceLoading] = useState(false);
  const [nativeSubmitting, setNativeSubmitting] = useState(false);

  // ── ERC20 state ──
  const [erc20List, setErc20List] = useState<Erc20TokenConfig[]>([]);
  const [erc20ListLoading, setErc20ListLoading] = useState(false);
  const [erc20BalanceLoading, setErc20BalanceLoading] = useState(false);
  const [selectedErc20, setSelectedErc20] = useState<Erc20TokenConfig | null>(
    null
  );
  const [erc20Details, setErc20Details] = useState<
    Record<
      string,
      { name: string; symbol: string; decimals: number; balance: bigint | null }
    >
  >({});
  const [erc20PointsInput, setErc20PointsInput] = useState("");
  const [erc20Submitting, setErc20Submitting] = useState(false);

  // ── C2C 积分充值（支付宝/微信，走 c2c 公开订单接口 /c2c/public/orders：无需登录）──
  const [c2cAmount, setC2cAmount] = useState("");
  const [c2cChannel, setC2cChannel] = useState("alipay");
  const [c2cSubmitting, setC2cSubmitting] = useState(false);
  // 币种由通道决定：stripe→USD，alipay/wechat→CNY。链上按商户挂单汇率计价，前端只传积分（1 积分=$1）
  const c2cCurrency = c2cChannel === "stripe" ? "USD" : "CNY";
  // 下单成功后返回的付款指令：gateway_order/qrcode（支付宝/微信）展示二维码；link（Stripe）跳转
  // buyerAddress = 下单用的链上地址，查进度时按它校验订单归属
  const [c2cPay, setC2cPay] = useState<{
    orderNo: string;
    buyerAddress: string;
    channel: string;
    instruction: { type: string; value: string };
  } | null>(null);

  const decimals = nativeToken?.decimals ?? 18;
  const symbol = nativeToken?.symbol ?? "ETH";
  const currencyName = nativeToken?.name ?? "Native Token";

  // 合约按 (feeRate / 10000) 收取充值手续费，这里把「想得到的积分」反算成需要支付的毛额
  const feeBps = rechargeFeeRate > 0n && rechargeFeeRate < 10000n ? rechargeFeeRate : 0n;
  const feeDivisor = 10000n - feeBps;
  const feePercent = Number(feeBps) / 100;

  const nativePointsNum = useMemo(() => {
    // nativePointsInput 存「美元」原值字符串（如 "2.5"），这里直接取数值
    const n = Number(nativePointsInput);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [nativePointsInput]);

  const nativePayAmount = useMemo(() => {
    if (!nativeRate || nativeRate === 0n || nativePointsNum <= 0) return null;
    // 美元 → 链上积分（×1e6）→ 按 decimals 缩放，再除以汇率反算支付毛额
    const scaledCredits =
      BigInt(Math.floor(nativePointsNum * 1e6)) * 10n ** BigInt(decimals);
    const denominator = nativeRate * feeDivisor;
    if (denominator === 0n) return null;
    // 向上取整，保证扣除手续费后不少于页面展示的积分
    return (scaledCredits * 10000n + denominator - 1n) / denominator;
  }, [nativeRate, nativePointsNum, decimals, feeDivisor]);

  const nativeFeeAmount = useMemo(() => {
    if (!nativePayAmount || feeBps === 0n) return 0n;
    return (nativePayAmount * feeBps) / 10000n;
  }, [nativePayAmount, feeBps]);

  // ── ERC20 calculations ──
  const erc20PointsNum = useMemo(() => {
    // erc20PointsInput 存「美元」原值字符串（如 "2.5"），这里直接取数值
    const n = Number(erc20PointsInput);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [erc20PointsInput]);

  const erc20PayAmount = useMemo(() => {
    if (!selectedErc20 || selectedErc20.rate === 0n || erc20PointsNum <= 0)
      return null;
    // 美元 → 链上积分（×1e6），再按 rate/unit 反算支付毛额
    const points = BigInt(Math.floor(erc20PointsNum * 1e6));
    const denominator = selectedErc20.rate * feeDivisor;
    if (denominator === 0n) return null;
    // 向上取整，保证扣除手续费后不少于页面展示的积分
    return (points * selectedErc20.unit * 10000n + denominator - 1n) / denominator;
  }, [selectedErc20, erc20PointsNum, feeDivisor]);

  const erc20FeeAmount = useMemo(() => {
    if (!erc20PayAmount || feeBps === 0n) return 0n;
    return (erc20PayAmount * feeBps) / 10000n;
  }, [erc20PayAmount, feeBps]);

  // Minimum recharge amount in USD
  const MIN_RECHARGE_AMOUNT = 2;
  // nativePointsNum / erc20PointsNum 现在就是「美元」原值，直接比较
  const belowMinNative = nativePointsNum > 0 && nativePointsNum < MIN_RECHARGE_AMOUNT;
  const belowMinErc20 = erc20PointsNum > 0 && erc20PointsNum < MIN_RECHARGE_AMOUNT;
  const c2cAmountNum = Number(c2cAmount);
  const belowMinC2c =
    Number.isFinite(c2cAmountNum) &&
    c2cAmountNum > 0 &&
    c2cAmountNum < MIN_RECHARGE_AMOUNT;
  const nativeInsufficient =
    nativePayAmount !== null &&
    nativeBalance !== null &&
    nativePayAmount > nativeBalance;

  const selectedErc20Balance = useMemo(() => {
    if (!selectedErc20) return null;
    // 余额查询中：先不展示/判断余额，等结果出来后补上
    if (erc20BalanceLoading) return null;
    return erc20Details[selectedErc20.address.toLowerCase()]?.balance ?? null;
  }, [selectedErc20, erc20Details, erc20BalanceLoading]);

  const erc20Insufficient =
    erc20PayAmount !== null &&
    selectedErc20Balance !== null &&
    erc20PayAmount > selectedErc20Balance;

  // ── Fetch native rate & balance ──
  const fetchNativeData = useCallback(async () => {
    if (!provider || !chainId) return;
    setNativeRateLoading(true);
    setNativeBalanceLoading(true);
    try {
      const rateValue = await getRateSol(provider, chainId);
      setNativeRate(rateValue);
      setRechargeFeeRate(await getRechargeFeeRateSol(provider, chainId));
    } catch (err) {
      console.error("Failed to fetch rate:", err);
    } finally {
      setNativeRateLoading(false);
    }
    try {
      if (address) {
        const bal = (await provider.request({
          method: "eth_getBalance",
          params: [address, "latest"],
        })) as string;
        setNativeBalance(BigInt(bal || "0x0"));
      }
    } catch (err) {
      console.error("Failed to fetch balance:", err);
    } finally {
      setNativeBalanceLoading(false);
    }
  }, [provider, chainId, address]);

  // ── Fetch ERC20 list (API) + 余额 (链上实时) ──
  const fetchErc20List = useCallback(async () => {
    if (!provider || !chainId) return;

    setErc20ListLoading(true);
    let configs: Erc20TokenConfig[] = [];
    try {
      const entries = await fetchErc20ListApi(chainId);
      const activeList = entries.filter((e) => e.active);
      configs = activeList.map((e) => ({
        address: e.address as `0x${string}`,
        active: e.active,
        rate: BigInt(e.rate),
        unit: BigInt(e.unit),
      }));
      setErc20List(configs);
      if (configs.length > 0) {
        setSelectedErc20((prev) => prev ?? configs[0]);
      }

      // 元数据直接来自接口（name/decimals），余额先置 null（未知），实时查询后更新。
      // 不能初始化为 0n：查询失败/未索引时会被误判为「余额 0」→ 误报余额不足并禁用充值。
      const metaMap: Record<
        string,
        { name: string; symbol: string; decimals: number; balance: bigint | null }
      > = {};
      for (const e of activeList) {
        metaMap[e.address.toLowerCase()] = {
          name: e.name,
          symbol: e.name,
          decimals: e.decimals,
          balance: null,
        };
      }
      setErc20Details(metaMap);
    } catch (err) {
      console.error("Failed to fetch ERC20 list:", err);
    } finally {
      // 列表先展示，余额异步补上
      setErc20ListLoading(false);
    }

    // 余额实时查询：Blockscout 与链上并行查询同时发起，合并后取链上为准（不互相等待）。
    // 不用 Promise.any「先返回者胜出」：getErc20BalancesBatch 内部用 allSettled、失败时返回 {}
    // （不抛错），Promise.any 会以 {} 兑现导致余额停留在未知；Blockscout 对未索引代币返回 0n
    // 且往往先兑现，会覆盖真实余额。这里两路都等，链上结果（权威）覆盖 Blockscout 兜底。
    if (configs.length > 0 && address) {
      setErc20BalanceLoading(true);
      try {
        const tokens = configs.map((t) => t.address);
        const [onChainRes, blockscoutRes] = await Promise.allSettled([
          getErc20BalancesBatch(
            provider,
            tokens,
            address as `0x${string}`,
            chainId
          ),
          fetchErc20BalancesFromBlockscout(chainId, address, tokens),
        ]);
        const balances: Record<string, bigint> = {};
        // Blockscout 先铺底（索引近实时，覆盖已索引代币）
        if (blockscoutRes.status === "fulfilled") {
          Object.assign(balances, blockscoutRes.value);
        }
        // 链上结果覆盖（权威值，含刚转入尚未被 Blockscout 索引的代币）
        if (onChainRes.status === "fulfilled") {
          Object.assign(balances, onChainRes.value);
        }
        // 两路都失败才抛错（由外层 catch 记录）
        if (
          onChainRes.status === "rejected" &&
          blockscoutRes.status === "rejected"
        ) {
          throw onChainRes.reason;
        }
        setErc20Details((prev) => {
          const next = { ...prev };
          for (const [k, v] of Object.entries(balances)) {
            if (next[k]) next[k] = { ...next[k], balance: v };
          }
          return next;
        });
      } catch (err) {
        console.error("Failed to fetch ERC20 balances:", err);
      } finally {
        setErc20BalanceLoading(false);
      }
    }
  }, [provider, chainId, address]);

  // ── Load data on open ──
  useEffect(() => {
    if (open && provider && chainId) {
      startTransition(() => {
        void fetchNativeData();
        void fetchErc20List();
      });
    }
  }, [open, provider, chainId, fetchNativeData, fetchErc20List]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setTab("erc20");
        setNativePointsInput("");
        setErc20PointsInput("");
        setC2cAmount("");
        setC2cPay(null);
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange]
  );

  // C2C 扫码支付完成（链上放款成功）：关闭二维码弹窗 + 充值弹窗，并提示积分已到账
  const handleC2cCompleted = useCallback(() => {
    pushToast({
      title: t("recharge.c2c.completed_title", "充值成功"),
      description: t("recharge.c2c.completed_desc", "积分已到账"),
      variant: "success",
      durationMs: 5000,
    });
    handleOpenChange(false);
  }, [t, handleOpenChange]);

  // ── Native recharge handler ──
  const handleNativeRecharge = async () => {
    if (
      !provider ||
      !chainId ||
      nativePayAmount === null ||
      nativePayAmount <= 0n ||
      !address
    )
      return;

    const contractAddress = (() => {
      try {
        return getContractAddress(chainId);
      } catch (err) {
        return `error: ${String(err)}`;
      }
    })();

    await logWalletContext("native:start", provider, {
      appChainId: chainId,
      web3authChainId: w3ChainId,
      address,
      contractAddress,
      pointsInput: nativePointsInput,
      pointsNum: nativePointsNum,
      payAmountWei: nativePayAmount.toString(),
      nativeBalanceWei: nativeBalance?.toString() ?? null,
      nativeBalanceLoading,
      nativeRate: nativeRate?.toString() ?? null,
      nativeRateLoading,
      decimals,
      symbol,
    });

    setNativeSubmitting(true);
    console.log("[Recharge][native] sending", {
      chainId,
      from: address,
      to: contractAddress,
      valueWei: nativePayAmount.toString(),
    });
    try {
      const txHash = await rechargeSol(
        provider,
        chainId,
        nativePayAmount,
        address
      );
      console.log("[Recharge][native] submitted", { txHash });
      showInfo(
        t(
          "recharge.messages.native_submitted",
          "充值已提交，交易哈希: {{hash}}",
          { hash: txHash.slice(0, 20) + "..." }
        )
      );
      if (address && provider) {
        useRechargeStore.getState().startPolling(address, provider, txHash);
      }
      onOpenChange(false);
      setNativePointsInput("");
    } catch (err) {
      console.error("[Recharge][native] failed", describeEvmError(err));
      await logWalletContext("native:failed", provider, {
        appChainId: chainId,
        web3authChainId: w3ChainId,
        address,
        contractAddress,
        payAmountWei: nativePayAmount.toString(),
      });
      const msg = err instanceof Error ? err.message : String(err);
      console.log("[Recharge][native] error message", msg);
      if (
        msg.toLowerCase().includes("user rejected") ||
        msg.toLowerCase().includes("user denied") ||
        msg.toLowerCase().includes("user closed")
      ) {
        showInfo(t("recharge.messages.cancelled", "已取消充值"));
      } else {
        showError(
          t("recharge.messages.native_failed", "充值失败: {{message}}", {
            message: msg,
          })
        );
      }
    } finally {
      setNativeSubmitting(false);
    }
  };

  // ── ERC20 recharge handler ──
  const handleErc20Recharge = async () => {
    if (
      !provider ||
      !chainId ||
      !selectedErc20 ||
      erc20PayAmount === null ||
      erc20PayAmount <= 0n ||
      !address
    )
      return;

    const contractAddress = (() => {
      try {
        return getContractAddress(chainId);
      } catch (err) {
        return `error: ${String(err)}`;
      }
    })();
    const tokenDetail = erc20Details[selectedErc20.address.toLowerCase()];

    await logWalletContext("erc20:start", provider, {
      appChainId: chainId,
      web3authChainId: w3ChainId,
      address,
      contractAddress,
      tokenAddress: selectedErc20.address,
      tokenSymbol: tokenDetail?.symbol ?? null,
      tokenDecimals: tokenDetail?.decimals ?? null,
      tokenBalance: selectedErc20Balance?.toString() ?? null,
      pointsInput: erc20PointsInput,
      pointsNum: erc20PointsNum,
      payAmount: erc20PayAmount.toString(),
      rate: selectedErc20.rate.toString(),
      unit: selectedErc20.unit.toString(),
    });

    setErc20Submitting(true);
    try {
      const tokenSolAddr = getContractAddress(chainId);
      console.log("[ERC20 Recharge] Contract address:", tokenSolAddr);
      console.log("[ERC20 Recharge] Erc20 Contract:", selectedErc20);

      const allowance = await getErc20Allowance(
        provider,
        selectedErc20.address,
        address as `0x${string}`,
        tokenSolAddr
      );

      console.log(
        "[ERC20 Recharge] Allowance:",
        allowance.toString(),
        "need:",
        erc20PayAmount.toString()
      );

      if (allowance < erc20PayAmount) {
        console.log("[ERC20 Recharge] Approving...");
        const approveTxHash = await approveErc20Max(
          provider,
          selectedErc20.address,
          tokenSolAddr,
          address
        );
        console.log(
          "[ERC20 Recharge] Approved, waiting for on-chain confirmation..."
        );
        // 等待 approve 交易真正上链，否则后续 recharge 的预演会因 allowance 未生效而报错
        await waitForTxReceipt(provider, approveTxHash);
        console.log("[ERC20 Recharge] Approval confirmed on-chain");
      }

      console.log("[ERC20 Recharge] Calling recharge...");
      console.log({
        provider,
        chainId,
        erc20Address: selectedErc20.address,
        erc20PayAmount,
        address,
      });
      const txHash = await rechargeErc20(
        provider,
        chainId,
        selectedErc20.address,
        erc20PayAmount,
        address
      );
      console.log("[ERC20 Recharge] TxHash:", txHash);
      showInfo(
        t(
          "recharge.messages.erc20_submitted",
          "ERC20 充值已提交，交易哈希: {{hash}}",
          { hash: txHash.slice(0, 20) + "..." }
        )
      );
      if (address && provider) {
        useRechargeStore.getState().startPolling(address, provider, txHash);
      }
      onOpenChange(false);
      setErc20PointsInput("");
    } catch (err) {
      console.error("[ERC20 Recharge] Error:", describeEvmError(err));
      await logWalletContext("erc20:failed", provider, {
        appChainId: chainId,
        web3authChainId: w3ChainId,
        address,
        contractAddress,
        tokenAddress: selectedErc20.address,
        payAmount: erc20PayAmount.toString(),
      });
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Approve tx reverted")) {
        showError(
          t("recharge.messages.approve_failed", "授权交易失败，请重试")
        );
      } else if (msg.includes("Approve tx timeout")) {
        showError(
          t("recharge.messages.approve_timeout", "授权确认超时，请稍后重试")
        );
      } else if (
        msg.toLowerCase().includes("user rejected") ||
        msg.toLowerCase().includes("user denied") ||
        msg.toLowerCase().includes("user closed") ||
        msg.includes("取消授权")
      ) {
        showInfo(t("recharge.messages.cancelled", "已取消充值"));
      } else {
        showError(
          t("recharge.messages.erc20_failed", "ERC20 充值失败: {{message}}", {
            message: msg,
          })
        );
      }
    } finally {
      setErc20Submitting(false);
    }
  };

  // ── C2C 充值（走 c2c 公开下单接口 /c2c/public/orders，无需登录）──
  const handleC2cRecharge = async () => {
    const amount = Number(c2cAmount);
    if (!amount || amount <= 0) {
      showError(t("recharge.c2c.invalid_amount", "请输入有效的充值积分数量"));
      return;
    }
    // if (belowMinC2c) {
    //   showError(
    //     t("recharge.c2c.min_amount", "最低充值金额为 {{amount}} 积分", {
    //       amount: MIN_RECHARGE_AMOUNT,
    //     })
    //   );
    //   return;
    // }
    // 与 c2c 平台 Buyer.tsx 一致：points_amount 传「积分」原值（最多 2 位小数）。
    // 最小单位（×100）由服务端 fx.ParsePointsFromFloat 统一换算，调用方不要再乘，
    // 否则金额会被放大 100 倍（用户输入 $2 会下单成 200 积分）。
    const pointsAmount = Math.round(amount * 100) / 100;
    if (!address) {
      showError(t("recharge.c2c.login_required", "请先登录后再充值"));
      return;
    }
    setC2cSubmitting(true);
    try {
      // 公开下单接口：无需登录，buyer_address 即下单身份（链上余额/放款按它记账）
      const result = await createC2cOrder({
        buyerAddress: address,
        pointsAmount,
        currency: c2cCurrency,
        channel: c2cChannel,
        idempotencyKey: newIdemKey(),
      });
      if (!result.payment?.instruction) {
        showInfo(
          t("recharge.c2c.no_instruction", "订单已创建，但未拿到付款指令")
        );
        return;
      }
      setC2cPay({
        orderNo: result.order_no,
        buyerAddress: address,
        channel: result.payment.channel,
        instruction: result.payment.instruction,
      });
      showInfo(
        t("recharge.c2c.order_created", "订单已创建: {{order}}", {
          order: result.order_no,
        })
      );
    } catch (e) {
      showError(
        t("recharge.c2c.failed", "充值失败: {{message}}",
          { message: (e as Error).message }
        )
      );
    } finally {
      setC2cSubmitting(false);
    }
  };

  const renderNativeTab = () => (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label className="text-[12px] text-subtle">
          {t("recharge.labels.pay_token", "支付货币")}
        </Label>
        <div className="flex items-center gap-3 p-3 rounded-md bg-surface border border-border">
          <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
            <Coins className="size-4 text-primary/80" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground/88">
              {currencyName}
            </div>
            <div className="text-[11px] text-subtle">
              {t(
                "recharge.native.native_currency",
                "{{symbol}} — 当前链原生货币",
                { symbol }
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            {nativeBalanceLoading ? (
              <Loader2 className="size-3 animate-spin text-subtle" />
            ) : nativeBalance !== null ? (
              <>
                <div className="text-[12px] font-medium text-foreground/75">
                  {formatTokenAmount(nativeBalance, decimals)} {symbol}
                </div>
                <div className="text-[10px] text-subtle">
                  {t("recharge.common.balance", "余额")}
                </div>
              </>
            ) : (
              <span className="text-[11px] text-subtle">—</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-[12px] text-subtle">
          {t("recharge.labels.amount", "充值金额 ($)")}
        </Label>
        <div className="relative">
          <Input
            type="number"
            placeholder="0"
            min="0"
            value={nativePointsInput}
            onChange={(e) => setNativePointsInput(e.target.value)}
            className="h-10 text-[13px] bg-surface border-border text-foreground/88 placeholder:text-subtle focus-visible:ring-ring/20 focus-visible:border-border rounded-md pr-14"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-subtle">
            $
          </span>
        </div>
        {belowMinNative && (
          <p className="text-[11px] text-destructive">
            {t("recharge.common.min_amount", "最低充值金额为 ${{amount}}", {
              amount: MIN_RECHARGE_AMOUNT,
            })}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-[12px] text-subtle">
          {t("recharge.labels.payment_details", "支付详情")}
        </Label>
        <div className="rounded-md bg-surface border border-border p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-subtle">
              {t("recharge.common.rate", "汇率")}
            </span>
            <span className="text-foreground/75">
              {nativeRateLoading ? (
                <Loader2 className="size-3 animate-spin inline" />
              ) : nativeRate ? (
                `1 ${symbol} = $${formatCredits(Number(nativeRate))}`
              ) : (
                "—"
              )}
            </span>
          </div>
          <div className="w-full border-t border-border" />
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-subtle">
              {t("recharge.common.need_to_pay", "需要支付")}
            </span>
            <span className="text-foreground/88 font-medium">
              {nativePayAmount !== null && nativePayAmount > 0n
                ? `${formatTokenAmount(nativePayAmount, decimals)} ${symbol}`
                : "—"}
            </span>
          </div>
          {feeBps > 0n && nativePayAmount !== null && nativePayAmount > 0n && (
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-subtle">
                {t("recharge.common.fee_rate", "手续费 ({{rate}}%)", {
                  rate: feePercent,
                })}
              </span>
              <span className="text-foreground/75">
                {formatTokenAmount(nativeFeeAmount, decimals)} {symbol}
              </span>
            </div>
          )}
          {nativePointsNum > 0 &&
            nativePayAmount !== null &&
            nativePayAmount > 0n && (
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-subtle">
                  {t("recharge.common.will_receive", "预计获得")}
                </span>
                <span className="text-foreground font-medium">
                  ${parseFloat(nativePointsNum.toFixed(2))}
                </span>
              </div>
            )}
          {nativeInsufficient && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/25 px-3 py-2">
              <AlertTriangle className="size-3.5 text-destructive shrink-0 mt-0.5" />
              <span className="text-[11px] text-destructive leading-relaxed">
                {t(
                  "recharge.common.insufficient_balance",
                  "余额不足：需要 {{need}}，当前余额 {{have}}",
                  {
                    need: `${formatTokenAmount(
                      nativePayAmount!,
                      decimals
                    )} ${symbol}`,
                    have: `${formatTokenAmount(
                      nativeBalance!,
                      decimals
                    )} ${symbol}`,
                  }
                )}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderErc20Tab = () => (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label className="text-[12px] text-subtle">
          {t("recharge.labels.select_token", "选择代币")}
        </Label>
        {erc20ListLoading ? (
          <div className="flex items-center gap-2 p-3 rounded-md bg-surface border border-border">
            <Loader2 className="size-4 animate-spin text-subtle" />
            <span className="text-[12px] text-subtle">
              {t("recharge.common.loading", "加载中…")}
            </span>
          </div>
        ) : erc20List.length === 0 ? (
          <div className="p-3 rounded-md bg-surface border border-border text-[12px] text-subtle">
            {t("recharge.erc20.no_tokens", "当前链暂无可充值的 ERC20 代币")}
          </div>
        ) : (
          <Select
            value={selectedErc20?.address}
            onValueChange={(value) => {
              const tk = erc20List.find(
                (t) => t.address.toLowerCase() === value.toLowerCase()
              );
              if (tk) setSelectedErc20(tk);
            }}
            disabled={erc20List.length === 0}
          >
            <SelectTrigger className="text-[13px] py-4 h-12 bg-surface border-border">
              <SelectValue
                placeholder={t("recharge.erc20.placeholder", "选择代币")}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {erc20List.map((tk) => {
                  const detail = erc20Details[tk.address.toLowerCase()];
                  return (
                    <SelectItem key={tk.address} value={tk.address}>
                      <span className="truncate">
                        {detail?.name ??
                          `${tk.address.slice(0, 6)}...${tk.address.slice(-4)}`}
                      </span>
                      {detail && (
                        <span className="ml-2 text-subtle text-[11px]">
                          {erc20BalanceLoading ? (
                            <Loader2 className="size-3 animate-spin inline" />
                          ) : detail.balance !== null ? (
                            `${formatTokenAmount(
                              detail.balance,
                              detail.decimals
                            )} ${detail.symbol}`
                          ) : (
                            "—"
                          )}
                        </span>
                      )}
                    </SelectItem>
                  );
                })}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-[12px] text-subtle">
          {t("recharge.labels.amount", "充值金额 ($)")}
        </Label>
        <div className="relative">
          <Input
            type="number"
            placeholder="0"
            min="0"
            value={erc20PointsInput}
            onChange={(e) => setErc20PointsInput(e.target.value)}
            disabled={erc20List.length === 0}
            className="h-10 text-[13px] bg-surface border-border text-foreground/88 placeholder:text-subtle focus-visible:ring-ring/20 focus-visible:border-border rounded-md pr-14"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-subtle">
            $
          </span>
        </div>
        {belowMinErc20 && (
          <p className="text-[11px] text-destructive">
            {t("recharge.common.min_amount", "最低充值金额为 ${{amount}}", {
              amount: MIN_RECHARGE_AMOUNT,
            })}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-[12px] text-subtle">
          {t("recharge.labels.payment_details", "支付详情")}
        </Label>
        <div className="rounded-md bg-surface border border-border p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-subtle">
              {t("recharge.common.rate", "汇率")}
            </span>
            <span className="text-foreground/75">
              {erc20ListLoading ? (
                <Loader2 className="size-3 animate-spin inline" />
              ) : selectedErc20 && selectedErc20.rate !== 0n ? (
                `1 ${
                  erc20Details[selectedErc20.address.toLowerCase()]?.symbol ??
                  `${selectedErc20.address.slice(0, 6)}...`
                } = $${formatCredits(Number(selectedErc20.rate))}`
              ) : (
                "—"
              )}
            </span>
          </div>
          <div className="w-full border-t border-border" />
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-subtle">
              {t("recharge.common.need_to_pay", "需要支付")}
            </span>
            <span className="text-foreground/88 font-medium">
              {erc20PayAmount !== null && erc20PayAmount > 0n
                ? `${formatTokenAmount(
                    erc20PayAmount,
                    selectedErc20
                      ? erc20Details[selectedErc20.address.toLowerCase()]
                          ?.decimals ?? 18
                      : 18
                  )} ${
                    selectedErc20
                      ? erc20Details[selectedErc20.address.toLowerCase()]
                          ?.symbol ?? ""
                      : ""
                  }`
                : "—"}
            </span>
          </div>
          {feeBps > 0n && erc20PayAmount !== null && erc20PayAmount > 0n && (
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-subtle">
                {t("recharge.common.fee_rate", "手续费 ({{rate}}%)", {
                  rate: feePercent,
                })}
              </span>
              <span className="text-foreground/75">
                {formatTokenAmount(
                  erc20FeeAmount,
                  selectedErc20
                    ? erc20Details[selectedErc20.address.toLowerCase()]
                        ?.decimals ?? 18
                    : 18
                )}{" "}
                {selectedErc20
                  ? erc20Details[selectedErc20.address.toLowerCase()]?.symbol ??
                    ""
                  : ""}
              </span>
            </div>
          )}
          {erc20PointsNum > 0 &&
            erc20PayAmount !== null &&
            erc20PayAmount > 0n && (
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-subtle">
                  {t("recharge.common.will_receive", "预计获得")}
                </span>
                <span className="text-foreground font-medium">
                  ${parseFloat(erc20PointsNum.toFixed(2))}
                </span>
              </div>
            )}
          {erc20Insufficient && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/25 px-3 py-2">
              <AlertTriangle className="size-3.5 text-destructive shrink-0 mt-0.5" />
              <span className="text-[11px] text-destructive leading-relaxed">
                {t(
                  "recharge.common.insufficient_balance",
                  "余额不足：需要 {{need}}，当前余额 {{have}}",
                  {
                    need: `${formatTokenAmount(
                      erc20PayAmount!,
                      selectedErc20
                        ? erc20Details[selectedErc20.address.toLowerCase()]
                            ?.decimals ?? 18
                        : 18
                    )} ${
                      selectedErc20
                        ? erc20Details[selectedErc20.address.toLowerCase()]
                            ?.symbol ?? ""
                        : ""
                    }`,
                    have: `${formatTokenAmount(
                      selectedErc20Balance!,
                      selectedErc20
                        ? erc20Details[selectedErc20.address.toLowerCase()]
                            ?.decimals ?? 18
                        : 18
                    )} ${
                      selectedErc20
                        ? erc20Details[selectedErc20.address.toLowerCase()]
                            ?.symbol ?? ""
                        : ""
                    }`,
                  }
                )}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="text-[11px] text-subtle leading-relaxed">
        {t(
          "recharge.erc20.approve_hint",
          "需要先在钱包中授权代币转账，然后才能充值。"
        )}
      </div>
    </div>
  );

  const isQrDialogOpen = c2cPay !== null && c2cPay.instruction.type !== "link";

  const renderC2cTab = () => (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label className="text-[12px] text-subtle">
          {t("recharge.labels.c2c_amount", "充值积分")}
        </Label>
        <div className="relative">
          <Input
            type="number"
            placeholder="0"
            min="0"
            value={c2cAmount}
            onChange={(e) => setC2cAmount(e.target.value)}
            className="h-10 text-[13px] bg-surface border-border text-foreground/88 placeholder:text-subtle focus-visible:ring-ring/20 focus-visible:border-border rounded-md pr-14"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-subtle">
            $
          </span>
        </div>
        {/*{belowMinC2c && (
          <p className="text-[11px] text-destructive">
            {t("recharge.c2c.min_amount", "最低充值金额为 {{amount}} 积分",
              { amount: MIN_RECHARGE_AMOUNT }
            )}
          </p>
        )}*/}
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-[11px] text-subtle">
          {t("recharge.labels.channel", "支付渠道")}
        </Label>
        <div className="grid grid-cols-3 gap-2">
          {/* Stripe 暂未开放：先禁用（恢复时删掉 disabled、提示行，并把默认渠道改回 stripe） */}
          <button
            type="button"
            onClick={() => setC2cChannel("stripe")}
            aria-pressed={c2cChannel === "stripe"}
            disabled
            className="flex cursor-not-allowed flex-col items-center justify-center gap-1.5 rounded-md border border-border bg-surface p-2.5 text-subtle opacity-50"
          >
            <StripeIcon className="size-4 mt-1" />
            <span className="text-[12px] font-medium">
              {t("recharge.channels.strip", "Stripe")}
            </span>
            <span className="text-[10px] text-subtle/70">
              {t("recharge.c2c.unavailable", "暂不可用")}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setC2cChannel("alipay")}
            aria-pressed={c2cChannel === "alipay"}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 rounded-md border p-2.5 transition-all",
              c2cChannel === "alipay"
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-surface text-subtle hover:text-foreground/80"
            )}
          >
            <AlipayIcon className="size-4 mt-1" />
            <span className="text-[12px] font-medium">
              {t("recharge.channels.alipay", "支付宝")}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setC2cChannel("wechat")}
            aria-pressed={c2cChannel === "wechat"}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 rounded-md border p-2.5 transition-all",
              c2cChannel === "wechat"
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-surface text-subtle hover:text-foreground/80"
            )}
          >
            <WechatPayIcon className="size-4 mt-1" />
            <span className="text-[12px] font-medium">
              {t("recharge.channels.wechat", "微信支付")}
            </span>
          </button>
        </div>
        <div className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2">
          <span className="text-[11px] text-subtle">
            {t("recharge.labels.currency", "支付币种")}
          </span>
          <span className="text-[12px] font-medium">
            {c2cCurrency === "USD" ? "USD" : "CNY (¥)"}
          </span>
        </div>
      </div>

      {c2cPay && c2cPay.instruction.type === "link" ? (
        <C2cPayResult pay={c2cPay} onCompleted={handleC2cCompleted} />
      ) : null}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="gap-0 p-0 sm:max-w-[460px] max-h-[90vh] overflow-hidden flex flex-col border-border bg-background"
        showCloseButton={false}
      >
        <DialogHeader className="text-left shrink-0 px-6 pt-5 pb-3">
          <DialogTitle className="flex items-center gap-2.5 text-base font-semibold text-foreground/92">
            <Zap className="size-4 text-foreground/75" />
            {t("recharge.title", "积分充值")}
          </DialogTitle>
          <DialogDescription className="text-[12px] text-subtle mt-0.5">
            {t("recharge.subtitle", "选择充值方式，充值后将实时到账")}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-3">
          <div className="grid grid-cols-3 gap-2">
            <TabButton
              id="erc20"
              label={t("recharge.tabs.erc20", "ERC20")}
              icon={CircleDollarSign}
              active={tab === "erc20"}
              onClick={setTab}
            />
            <TabButton
              id="native"
              label={t("recharge.tabs.native", "原生代币")}
              icon={Coins}
              active={tab === "native"}
              onClick={setTab}
            />
            <TabButton
              id="c2c"
              label={t("recharge.tabs.c2c", "法币")}
              icon={Wallet}
              active={tab === "c2c"}
              onClick={setTab}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-5">
          {tab === "native" && renderNativeTab()}
          {tab === "erc20" && renderErc20Tab()}
          {tab === "c2c" && renderC2cTab()}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border shrink-0 flex-row items-center justify-between sm:justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-subtle">
            <Coins className="size-3" />
            <span>
              {t("recharge.common.contract_verified", "合约地址已校验")}
            </span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-[12px] bg-transparent border-border text-subtle hover:bg-surface hover:text-foreground/88 rounded-md"
              onClick={() => handleOpenChange(false)}
              disabled={nativeSubmitting || erc20Submitting || c2cSubmitting}
            >
              {t("recharge.common.cancel", "取消")}
            </Button>
            {tab === "native" && (
              <Button
                size="sm"
                className="h-8 gap-1.5 text-[12px] font-medium rounded-md"
                onClick={handleNativeRecharge}
                disabled={
                  nativeSubmitting ||
                  nativeInsufficient ||
                  belowMinNative ||
                  !nativePointsNum ||
                  nativePayAmount === null ||
                  nativePayAmount <= 0n
                }
              >
                {nativeSubmitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    {t("recharge.common.recharging", "充值中…")}
                  </>
                ) : (
                  <>
                    <Zap className="size-3.5" />
                    {t("recharge.common.recharge", "充值")}
                  </>
                )}
              </Button>
            )}
            {tab === "erc20" && (
              <Button
                size="sm"
                className="h-8 gap-1.5 text-[12px] font-medium rounded-md"
                onClick={handleErc20Recharge}
                disabled={
                  erc20Submitting ||
                  erc20Insufficient ||
                  belowMinErc20 ||
                  erc20List.length === 0 ||
                  !erc20PointsNum ||
                  erc20PayAmount === null ||
                  erc20PayAmount <= 0n
                }
              >
                {erc20Submitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    {t("recharge.common.recharging", "充值中…")}
                  </>
                ) : (
                  <>
                    <Zap className="size-3.5" />
                    {t("recharge.common.recharge", "充值")}
                  </>
                )}
              </Button>
            )}
            {tab === "c2c" && (
              <Button
                size="sm"
                className="h-8 gap-1.5 text-[12px] font-medium rounded-md"
                onClick={handleC2cRecharge}
                disabled={
                  c2cSubmitting ||
                  !c2cAmount ||
                  c2cAmountNum <= 0
                }
              >
                {c2cSubmitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    {t("recharge.common.recharging", "充值中…")}
                  </>
                ) : (
                  <>
                    <Wallet className="size-3.5" />
                    {t("recharge.common.recharge", "充值")}
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>

      {/* QR 码弹窗：订单创建后自动弹出，覆盖在充值表单之上 */}
      <Dialog open={isQrDialogOpen} onOpenChange={(v) => { if (!v) setC2cPay(null); }}>
        <DialogContent
          className="gap-4 p-6 sm:max-w-[380px] max-h-[85vh] flex flex-col items-center overflow-y-auto border-border bg-background"
          showCloseButton
        >
          {c2cPay && (
            <C2cPayResult pay={c2cPay} onCompleted={handleC2cCompleted} />
          )}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
