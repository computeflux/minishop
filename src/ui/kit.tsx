import * as React from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Logo } from "./Logo";
import { cn } from "@/shared/lib/utils";
import { Dialog, DialogContent } from "@/ui/dialog";

/* ────────────────────────────────────────────────────────────────────────
   Design kit — the whole app is composed of these primitives so that
   every page shares the same black/white rhythm:
   micro labels, hairline panels, mono numbers, square corners.
   ──────────────────────────────────────────────────────────────────── */

/** Uppercase wide-tracked mono label. The app's smallest type. */
export function MicroLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("micro-label", className)}>{children}</div>
  );
}

/** Big light-weight page heading. */
export function Display({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h1 className={cn("display text-3xl text-white sm:text-4xl", className)}>
      {children}
    </h1>
  );
}

/**
 * Hairline stats grid — 固定 `cols`（2/3/6），3/6 在移动端降为 2 列。
 * The gap-px + bg trick yields uniform 1px hairlines in all directions.
 */
export function StatsGrid({
  items,
  cols = 6,
  compact = false,
  className,
}: {
  items: { label: string; value: React.ReactNode; sub?: string }[];
  cols?: 2 | 3 | 6;
  /** 紧凑变体 — 嵌套在卡片内时用：更小内边距 + 数值字号 */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-px border border-white/10 bg-white/10",
        cols === 2 && "grid-cols-2",
        cols === 3 && "grid-cols-2 sm:grid-cols-3",
        cols === 6 && "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
        className
      )}
    >
      {items.map((it) => (
        <div
          key={it.label}
          className={cn("bg-black", compact ? "p-3.5" : "p-4")}
        >
          <div className="micro-label">{it.label}</div>
          <div
            className={cn(
              "num leading-none text-white",
              compact ? "mt-1.5 text-base" : "mt-2 text-lg",
            )}
          >
            {it.value}
          </div>
          {it.sub ? (
            <div className="mt-1 text-[11px] text-white/35">{it.sub}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** 营业中 / 已停用 — square dot + hairline pill. */
export function StatusChip({
  active,
  activeText: aText,
  inactiveText: iText,
  className,
}: {
  active: boolean;
  activeText?: string;
  inactiveText?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const activeLabel = aText ?? t("minishop.common.running", "营业中");
  const inactiveLabel = iText ?? t("minishop.common.inactive", "已停用");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border px-2 py-0.5 text-[11px] leading-4",
        active
          ? "border-white/25 text-white"
          : "border-white/10 text-white/40",
        className
      )}
    >
      <span
        className={cn(
          "size-1.5",
          active
            ? "bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)]"
            : "bg-white/25"
        )}
      />
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}

/** Provider logo — LogoURL 图片；未设置时回退到项目 mini logo。 */
export function ProviderLogo({
  url,
  name,
  className,
}: {
  url?: string;
  name?: string;
  className?: string;
}) {
  const [errored, setErrored] = React.useState(false);
  if (url && !errored) {
    return (
      <img
        src={url}
        alt={name || "provider"}
        onError={() => setErrored(true)}
        className={cn("shrink-0 rounded object-cover", className)}
      />
    );
  }
  // 未设置 logo — 回退到项目 mini logo
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded border border-white/15 bg-white/[0.06] text-white/75",
        className
      )}
    >
      <Logo className="h-[55%] w-auto" />
    </div>
  );
}

/** Section heading with mono index, e.g. `01 — 算力商品`. */
export function SectionLabel({
  index,
  title,
  count,
  className,
}: {
  index?: string;
  title: string;
  count?: number | string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline gap-3", className)}>
      {index ? <span className="num text-[11px] text-white/30">{index}</span> : null}
      <span className="micro-label">{title}</span>
      {count != null ? (
        <span className="num text-[11px] text-white/30">{count}</span>
      ) : null}
    </div>
  );
}

/** Centered empty / loading / error block. */
export function StateBlock({
  state = "empty",
  title,
  desc,
  children,
}: {
  state?: "empty" | "loading" | "error";
  title: string;
  desc?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 border border-white/10 px-6 py-16 text-center">
      {state === "loading" && (
        <Loader2 className="size-4 animate-spin text-white/50" />
      )}
      <div className="text-sm text-white/80">{title}</div>
      {desc ? <div className="max-w-sm text-[13px] text-white/40">{desc}</div> : null}
      {children ? <div className="mt-2 flex items-center gap-2">{children}</div> : null}
    </div>
  );
}



/* ── 买家使用方式弹窗 ─────────────────────────────────────────────────
   Triggered from the shop identity card (next to 管理店铺). Shows the
   buyer journey: 01 充值积分 → 02 获取端点 → 03 按量结算.
   ───────────────────────────────────────────────────────────────────── */

export function UsageModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const STEPS = [
    { n: "01", title: t("minishop.usage.step1_title", "充值积分"), desc: t("minishop.usage.step1_desc", "以 PAS 或 ERC20 充值，积分进入网关余额。") },
    { n: "02", title: t("minishop.usage.step2_title", "获取端点"), desc: t("minishop.usage.step2_desc", "在商品详情复制 API 端点与密钥。") },
    { n: "03", title: t("minishop.usage.step3_title", "按量结算"), desc: t("minishop.usage.step3_desc", "调用即从余额自动扣费，链上留痕。") },
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t("minishop.usage.title", "How to use · 使用方式")} className="max-w-[560px]">
        <div className="grid gap-px bg-white/10 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="bg-black px-4 py-4">
              <div className="flex items-baseline gap-2">
                <span className="num text-[11px] text-white/30">{s.n}</span>
                <span className="text-[13px] font-medium text-white">{s.title}</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-white/40">{s.desc}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-white/30">
          {t("minishop.usage.footer", "连接钱包后即可充值并按量调用全网店铺的算力。")}
        </p>
      </DialogContent>
    </Dialog>
  );
}
