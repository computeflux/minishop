import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import type { ProviderInfoWithID } from "@/contracts/tee/types/gateway";
import { ProviderLogo, StatusChip } from "@/ui/kit";
import { regionLabel, compact } from "@/lib/model";
import { parseChainNumber } from "@/shared/utils";
import { useTranslation } from "react-i18next";

/**
 * 首页店铺列表 — 店铺卡片。
 * 展示：Logo / 名称 / 简介 / 商品数 / 区域 / 状态；整卡可点击进入店铺详情页（/:id）。
 */
export function ShopCard({ shop }: { shop: ProviderInfoWithID }) {
  const { t } = useTranslation();
  const id = parseChainNumber(shop.ID);
  const { Name, LogoURL, Description, ModelIds, Region, TotalRequests, IsActive } =
    shop.Data;

  return (
    <Link
      to={`/${id}`}
      className="group flex flex-col border border-white/10 bg-white/[0.02] p-5 transition-colors hover:border-white/25 hover:bg-white/[0.04]"
    >
      <div className="flex items-start gap-3">
        <ProviderLogo
          url={LogoURL}
          name={Name}
          className="size-12 rounded-md"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate text-sm font-medium text-white">
              {Name || t("minishop.shop.untitled", "未命名店铺")}
            </div>
            <ArrowUpRight className="size-3.5 shrink-0 text-white/25 transition-colors group-hover:text-white/70" />
          </div>
          <div className="num mt-1 text-[11px] text-white/35">
            {t("minishop.shop.id_label", "Shop · ID")} {id} · {regionLabel(Region)}
          </div>
        </div>
      </div>

      <p className="mt-3 line-clamp-2 min-h-[2.5em] text-[13px] leading-relaxed text-white/50">
        {Description || t("minishop.shop.no_desc", "这家店铺还没有介绍。")}
      </p>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/10 pt-3.5">
        <div className="flex items-center gap-3">
          <span className="num text-[11px] text-white/45">
            {t("minishop.shoplist.products", "商品")}{" "}
            <span className="text-white/80">{(ModelIds ?? []).length}</span>
          </span>
          <span className="num text-[11px] text-white/45">
            {t("minishop.shop.total_requests", "总请求")}{" "}
            <span className="text-white/80">{compact(parseChainNumber(TotalRequests))}</span>
          </span>
        </div>
        <StatusChip active={IsActive} />
      </div>
    </Link>
  );
}
