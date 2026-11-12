import { Link2, BookOpen } from "lucide-react";
import type { ProviderInfo } from "@/hooks/useShops";
import { Button } from "@/ui/button";
import { ProviderLogo, StatusChip, StatsGrid } from "@/ui/kit";
import { compact, pct, regionLabel } from "@/lib/model";
import { shortenAddress, copyText } from "@/shared/utils";
import { useTranslation } from "react-i18next";

/** 店铺页左栏 — 店铺身份卡（logo / 名字 / 状态 / 区域·店主 / 介绍 / 指标 / 操作） */
export function IdentityCard({
  id,
  provider,
  modelCount,
  isOwner,
  onManage,
  onOpenUsage,
}: {
  id: number;
  provider: ProviderInfo;
  /** 在售（active）模型数 — 与店铺橱窗列表一致 */
  modelCount: number;
  isOwner: boolean;
  onManage: () => void;
  onOpenUsage: () => void;
}) {
const { t } = useTranslation();
return (
  <div className="border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          <div className="absolute -inset-2 rounded-2xl bg-white/10 blur-xl" />
          <ProviderLogo
            url={provider.LogoURL}
            name={provider.Name}
            className="relative size-16 rounded-lg"
          />
        </div>
        <div className="min-w-0">
          <div className="micro-label">{t("minishop.shop.id_label", "Shop · ID")} {id}</div>
          <div className="mt-1.5 truncate text-xl font-semibold tracking-tight text-white">
            {provider.Name || t("minishop.shop.untitled", "未命名店铺")}
          </div>
        </div>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <StatusChip active={provider.IsActive} />
        <span className="font-mono text-[11px] text-white/35">
          {regionLabel(provider.Region)} · {t("minishop.shop.owner", "店主")}{" "}
          {shortenAddress(provider.Owner?.V)}
        </span>
      </div>

      <p className="mt-3.5 min-h-[2.5em] text-[13px] leading-relaxed text-white/55">
        {provider.Description || t("minishop.shop.no_desc", "这家店铺还没有介绍。")}
      </p>

      <div className="mt-4">
        <StatsGrid
          cols={2}
          compact
          items={[
            { label: t("minishop.shop.products", "算力商品"), value: String(modelCount) },
            { label: t("minishop.shop.success_rate", "成功率"), value: pct(provider.SuccessRate) },
            { label: t("minishop.shop.avg_latency", "平均延迟"), value: `${Math.round(provider.AvgLatency || 0)}ms` },
            { label: t("minishop.shop.total_requests", "总请求"), value: compact(provider.TotalRequests) },
          ]}
        />
      </div>

      <div className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-4">
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={onOpenUsage}
        >
          <BookOpen className="size-3.5" />
          {t("minishop.shop.usage", "使用方式")}
        </Button>
        {isOwner ? (
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={onManage}
          >
            {t("minishop.shop.manage", "管理店铺")}
          </Button>
        ) : null}
        <Button
          size="sm"
          variant={isOwner ? "ghost" : "outline"}
          className="w-full"
          onClick={() =>
            void copyText(`${window.location.origin}${import.meta.env.BASE_URL}#${id}`)
          }
        >
          <Link2 className="size-3.5" />
          {t("minishop.shop.share", "复制店铺链接 · 分享")}
        </Button>
      </div>
    </div>
  );
}
