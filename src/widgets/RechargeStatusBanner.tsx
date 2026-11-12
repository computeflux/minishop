import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, CheckCircle2, X, AlertCircle } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import type { RechargeStatus } from "@/shared/stores/recharge";

interface RechargeStatusBannerProps {
  status: RechargeStatus;
  error?: string | null;
  onDismiss: () => void;
  className?: string;
}

export function RechargeStatusBanner({
  status,
  error,
  onDismiss,
  className,
}: RechargeStatusBannerProps) {
  const { t } = useTranslation();

  // Auto-dismiss success banner after 5 seconds
  useEffect(() => {
    if (status !== "success") return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 5000);
    return () => clearTimeout(timer);
  }, [status, onDismiss]);

  if (status === "idle" && !error) return null;

  const isPending = status === "pending";
  const isSuccess = status === "success";

  const statusText = () => {
    if (isPending) {
      return t("recharge.pending", "TEE-chain recharge in progress, takes about 1 minute");
    }
    if (isSuccess) {
      return t("recharge.success", "Recharge successful!");
    }
    if (error) {
      return error.startsWith("recharge.")
        ? t(error, t("recharge.error", "Failed to get recharge status"))
        : error;
    }
    return t("recharge.pending", "TEE-chain recharge in progress, takes about 1 minute");
  };

  return (
    <div
      className={cn(
        "fixed left-0 right-0 top-[60px] z-40 flex items-center justify-center px-4 py-2",
        "pointer-events-none",
        className
      )}
    >
      <div
        className={cn(
          "pointer-events-auto border-none bg-background/95 flex items-center gap-3 rounded-lg px-4 py-3 shadow-md transition-all animate-in fade-in slide-in-from-top-2",
          isPending && "bg-[#1c3327]",
          isSuccess && "bg-[#104c19]",
          !isPending && !isSuccess && "bg-[#0d0100]"
        )}
      >
        {isPending && <Loader2 className="size-4 shrink-0 animate-spin" />}
        {isSuccess && (
          <CheckCircle2 className="size-4 shrink-0 animate-in zoom-in" />
        )}
        {!isPending && !isSuccess && (
          <AlertCircle className="size-4 shrink-0" />
        )}

        <span className="text-[13px] font-medium">{statusText()}</span>

        {(isSuccess || (!isPending && error)) && (
          <button
            type="button"
            onClick={onDismiss}
            className="ml-1 rounded-full p-1 hover:bg-foreground/10 transition-colors"
            aria-label={t("common.close", "Close")}
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
