import { Coins, LogOut, Wallet } from "lucide-react";
import {
  useWeb3Auth,
  useWeb3AuthConnect,
  useWeb3AuthDisconnect,
} from "@wetee/web3auth/react";
import { Button } from "@/ui/button";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import { useRechargeModal } from "@/app/recharge";
import { useUserBalanceModal } from "@/features/seller/UserBalanceModal";

/**
 * Header 右侧操作区（充值 + 钱包），控件统一 h-8。
 * 全局 Header 与店铺页 ShopBar 共用，避免重复。
 */
export function WalletActions({ className }: { className?: string }) {
  const { address, isConnected } = useWeb3Auth();
  const { connect, loading } = useWeb3AuthConnect();
  const { disconnect } = useWeb3AuthDisconnect();
  const { openRecharge } = useRechargeModal();
  const { openUserBalance } = useUserBalanceModal();
  const { t } = useTranslation();

  const addr = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";

  return (
    <div className={cn("flex shrink-0 items-center gap-0", className)}>
      {isConnected && address ? (
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={openRecharge}
            className="hidden sm:inline-flex"
          >
            <Coins className="size-3.5" />
            {t("floatingActions.rechargeShort", "充值")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={openUserBalance}
            title={t("minishop.seller.user_balance", "用户余额")}
            className="hidden h-8 items-center gap-2 border border-white/25 border-l-0 border-r-0 px-3 font-mono text-xs text-white/80 lg:flex cursor-pointer"
          >
            <span className="size-1.5 shrink-0 bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)]" />
            {addr}
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            onClick={() => void disconnect()}
            title={t("nav.disconnect", "断开连接")}
          >
            <LogOut className="size-4" />
          </Button>
        </>
      ) : (
        <Button size="sm" className="ml-2" onClick={connect} disabled={loading}>
          <Wallet className="size-3.5" />
          {loading ? t("nav.connecting", "连接中…") : t("nav.connect", "连接钱包")}
        </Button>
      )}
    </div>
  );
}
