import { useState } from "react";
import { Link } from "react-router-dom";
import { Coins, Plus, ExternalLink, Link2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/ui/button";
import { SectionLabel } from "@/ui/kit";
import { useShop } from "@/hooks/useShops";
import { useRechargeModal } from "@/app/recharge";
import { AddModelModal } from "@/features/model/AddModelModal";
import { ShopEditModal } from "@/features/seller/ShopEditModal";
import { Pencil } from "lucide-react";
import { pct, regionLabel } from "@/lib/model";
import { shortenAddress, copyText } from "@/shared/utils";

/** 概览 tab — 店铺信息 + 快速操作 + 卖家收益 */
export function OverviewTab({
  id,
  onClose,
  onViewRevenue,
}: {
  id: number;
  onClose?: () => void;
  onViewRevenue: () => void;
}) {
  const { t } = useTranslation();
  const { data: provider } = useShop(id);
  const { openRecharge } = useRechargeModal();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  if (!provider) return null;
  const p = provider.provider;

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
      {/* 店铺信息 */}
      <div className="border border-white/10 p-6">
        <div className="flex items-center justify-between">
          <SectionLabel index="01" title={t("minishop.seller.shop_info", "店铺信息")} />
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-[12px] text-white/50 hover:bg-white/5 hover:text-white"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="size-3.5" />
            {t("minishop.seller.edit_shop", "编辑")}
          </Button>
        </div>
        <p className="mt-4 min-h-[3em] text-sm leading-relaxed text-white/55">
          {p.Description || t("minishop.seller.no_desc", "这家店铺还没有介绍。")}
        </p>
        <dl className="mt-6 space-y-0 border-t border-white/10">
          {[
            { k: t("minishop.common.region", "区域"), v: regionLabel(p.Region) },
            { k: t("minishop.identity.owner", "店主地址"), v: shortenAddress(p.Owner?.V) },
            { k: t("minishop.seller.avg_latency", "平均延迟"), v: `${Math.round(p.AvgLatency || 0)} ms` },
            { k: t("minishop.seller.uptime_sla", "可用性 SLA"), v: pct(p.UptimeSLA) },
            { k: t("minishop.seller.fee_rate", "手续费"), v: `${(p.FeeRate || 0).toFixed(1)}%` },
          ].map((row) => (
            <div
              key={row.k}
              className="flex items-center justify-between border-b border-white/10 py-2.5"
            >
              <dt className="text-xs text-white/35">{row.k}</dt>
              <dd className="num text-[13px] text-white/85">{row.v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* 快速操作 */}
      <div className="flex flex-col gap-3">
        <div className="border border-white/10 p-6">
          <SectionLabel index="02" title={t("minishop.seller.quick_actions", "快速操作")} />
          <div className="mt-4 flex flex-col">
            {[
              {
                icon: <Coins className="size-4" />,
                label: t("minishop.seller.recharge_points", "充值积分"),
                act: () => openRecharge(),
              },
              {
                icon: <Plus className="size-4" />,
                label: t("minishop.seller.publish_product", "发布算力商品"),
                act: () => setAddOpen(true),
              },
              onClose
                ? {
                    icon: <ExternalLink className="size-4" />,
                    label: t("minishop.seller.view_shop_page", "查看店铺页"),
                    act: () => onClose(),
                  }
                : {
                    icon: <ExternalLink className="size-4" />,
                    label: t("minishop.seller.view_shop_page", "查看店铺页"),
                    to: `/${id}`,
                  },
              {
                icon: <Link2 className="size-4" />,
                label: t("minishop.seller.copy_shop_link", "复制店铺链接"),
                act: () =>
                  void copyText(`${window.location.origin}${import.meta.env.BASE_URL}#${id}`),
              },
            ].map((row, i) => (
              <QuickRow key={row.label} row={row} last={i === 3} />
            ))}
          </div>
        </div>
        <div className="flex flex-1 flex-col justify-between border border-white/10 p-6">
          <div>
            <SectionLabel index="03" title={t("minishop.seller.seller_revenue", "卖家收益")} />
            <p className="mt-4 text-[13px] leading-relaxed text-white/45">
              {t("minishop.seller.seller_revenue_desc", "买家调用你的算力，费用从买家积分余额实时结算，链上可查。")}
            </p>
          </div>
          <button
            type="button"
            onClick={onViewRevenue}
            className="mt-5 self-start text-[13px] text-white/60 underline-offset-4 transition-colors hover:text-white hover:underline"
          >
            {t("minishop.seller.view_revenue_records", "查看收益记录 →")}
          </button>
        </div>
      </div>

      <AddModelModal open={addOpen} onOpenChange={setAddOpen} id={id} />
      <ShopEditModal open={editOpen} onOpenChange={setEditOpen} provider={p} id={id} />
    </div>
  );
}

function QuickRow({
  row,
  last,
}: {
  row: {
    icon: React.ReactNode;
    label: string;
    to?: string;
    act?: () => void;
  };
  last: boolean;
}) {
  const cls =
    "flex items-center justify-between gap-3 px-3 py-3 text-[13px] text-white/80 transition-colors hover:bg-white/5 hover:text-white" +
    (last ? "" : " border-b border-white/10");
  const inner = (
    <>
      <span className="flex items-center gap-3">
        <span className="text-white/40">{row.icon}</span>
        {row.label}
      </span>
      <span className="text-white/25">→</span>
    </>
  );
  return row.to ? (
    <Link to={row.to} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" className={cls} onClick={row.act}>
      {inner}
    </button>
  );
}
