import { createContext, useContext, useState } from "react";
import { Coins, ArrowUpRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useWeb3Auth } from "@wetee/web3auth/react";
import { Button } from "@/ui/button";
import { Dialog, DialogContent } from "@/ui/dialog";
import { SectionLabel } from "@/ui/kit";
import { useCredit, useRechargeHistory } from "@/hooks/useShops";
import { useRechargeModal } from "@/app/recharge";
import { formatCredits, formatTimestamp } from "@/shared/utils";

/* ── 全局 用户余额 modal（header 余额胶囊 + 充值弹窗「历史记录」共用） ──
 * 用户余额属于「买家」视角，不该只在店铺管理的余额提现 tab 里。
 * 做成独立 modal，由 Header 的地址胶囊和 RechargeModal 的「历史记录」共同触发。
 */
type UserBalanceCtx = {
  open: boolean;
  setOpen: (open: boolean) => void;
  openUserBalance: () => void;
};

const UBCtx = createContext<UserBalanceCtx>({
  open: false,
  setOpen: () => {},
  openUserBalance: () => {},
});

export function UserBalanceProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <UBCtx.Provider
      value={{ open, setOpen, openUserBalance: () => setOpen(true) }}
    >
      {children}
    </UBCtx.Provider>
  );
}

export function useUserBalanceModal() {
  return useContext(UBCtx);
}

export function UserBalanceModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { address } = useWeb3Auth();
  const { data: creditRaw } = useCredit(address ?? undefined);
  const { data: recharge } = useRechargeHistory(address ?? undefined);
  const { openRecharge } = useRechargeModal();
  const credit = creditRaw ? Number(String(creditRaw).replace(/,/g, "")) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="gap-0 p-0 max-w-[560px]"
        eyebrow={t("minishop.seller.user_balance", "用户余额")}
        title={t("minishop.common.balance_history", "用户余额与充值记录")}
      >
        <div className="flex flex-col gap-3">
          <div className="border border-white/10 p-4">
            <SectionLabel index="01" title={t("minishop.seller.user_balance", "用户余额")} />
            <div className="mt-2 flex items-baseline gap-2">
              <span className="num text-3xl text-white">
                {formatCredits(credit)}
              </span>
              <span className="text-xs text-white/35">pts</span>
            </div>
            <div className="mt-3">
              <Button onClick={openRecharge} className="w-full">
                <Coins className="size-4" /> {t("minishop.seller.recharge_now", "立即充值")}
              </Button>
            </div>
          </div>

          <div className="border border-white/10 p-6">
            <SectionLabel
              index="02"
              title={t("minishop.common.recharge_history", "充值记录")}
              count={recharge?.length ?? 0}
            />
            <div className="mt-4">
              {!recharge || recharge.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-white/35">
                  {t("minishop.seller.no_recharge", "暂无充值记录")}
                </p>
              ) : (
                <div className="border-t border-white/10">
                  {recharge.map((r, i) => (
                    <div
                      key={i}
                      className={
                        "flex items-center justify-between py-3" +
                        (i < recharge.length - 1 ? " border-b border-white/10" : "")
                      }
                    >
                      <span className="text-[13px] text-white/70">
                        {t("minishop.seller.recharge_label", "充值")}
                      </span>
                      <span className="num text-[13px] text-white">
                        +{formatCredits(r.Amount)} pts
                      </span>
                      <span className="num text-xs text-white/35">
                        {formatTimestamp(Number(r.Time))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── 充值弹窗内的「历史记录」入口 ─────────────────────────────── */
export function HistoryEntry({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { openUserBalance, setOpen } = useUserBalanceModal();
  const { setOpen: setRechargeOpen } = useRechargeModal();

  return (
    <button
      type="button"
      onClick={() => {
        setRechargeOpen(false);
        openUserBalance();
      }}
      className={
        "flex items-center gap-1 text-[13px] text-white/50 transition-colors hover:text-white " +
        (className ?? "")
      }
    >
      {t("minishop.common.history", "历史记录")}
      <ArrowUpRight className="size-3.5" />
    </button>
  );
}
