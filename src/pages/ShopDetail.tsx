import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useShop } from "@/hooks/useShops";
import { Button } from "@/ui/button";
import { UsageModal, StateBlock } from "@/ui/kit";
import { parseModelMeta } from "@/lib/model";
import { useWeb3Auth } from "@wetee/web3auth/react";
import { Dialog, DialogContent } from "@/ui/dialog";
import { ShopBar } from "@/features/shop/ShopBar";
import { IdentityCard } from "@/features/shop/IdentityCard";
import { ModelCard } from "@/features/shop/ModelCard";
import { Dashboard } from "@/features/seller/Dashboard";
import { ModelDetailModal } from "./ModelDetailModal";
import { useTranslation } from "react-i18next";
import { useMeta } from "@/hooks/useMeta";
import { shareImageUrl } from "@/lib/share";
import { clientOrigin } from "@/shared/utils/client";
import { sameAddress } from "@/shared/utils";

/**
 * 店铺页（私域橱窗）— 档案式双栏结构：
 * - 顶部 ShopBar：店铺品牌 + 导航 + 钱包（接管全局 Header）
 * - 左栏：身份卡 — logo / 名字 / 状态 / 区域·店主 / 介绍 / 指标 / 操作
 * - 右栏：算力商品（卡片网格）
 */
export default function ShopDetail() {
  const { id } = useParams();
  // 私域店铺页 = 橱窗：只展示店主本人的在售模型
  const { data, isLoading, isError } = useShop(Number(id), {
    activeOnly: true,
  });
  const { address } = useWeb3Auth();
  const { t } = useTranslation();

  // 店铺页 SEO / 社交分享 meta：分享该店链接时，
  // Telegram / X / 微信预览会显示店名 + logo（见 shareImageUrl 与部署说明）。
  const shopName = data?.provider.Name;
  useMeta({
    title: shopName
      ? `${shopName} · ${t("minishop.seo.shop_title_suffix")}`
      : `ComputeFlux Shop · ${t("minishop.seo.shop_title_suffix")}`,
    description: data?.provider.Description
      ? t("minishop.seo.shop_description_with", { name: shopName, desc: data.provider.Description })
      : t("minishop.seo.shop_description_fallback", { name: shopName ?? "ComputeFlux Shop" }),
    imageUrl: data ? shareImageUrl(Number(id)) : undefined,
    url: `${clientOrigin()}${import.meta.env.BASE_URL}${id}`,
  });
  const [manageOpen, setManageOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  if (isLoading)
    return <Shell><StateBlock state="loading" title={t("minishop.shop.reading", "正在读取店铺…")} /></Shell>;
  if (isError || !data)
    return (
      <Shell>
        <StateBlock state="error" title={t("minishop.shop.not_found", "店铺不存在或加载失败。")}>
          <Link to="/">
            <Button size="sm" variant="outline">{t("minishop.common.back_home", "返回首页")}</Button>
          </Link>
        </StateBlock>
      </Shell>
    );

  const { provider, models } = data;
  // 邮箱登录（web3auth 内嵌钱包）返回小写地址，链上 Owner.V 是 checksummed → 必须忽略大小写
  const isOwner = sameAddress(address, provider.Owner?.V);
  // 按权重排序：权重越大越靠前，未设权重按 0
  const sortedModels = [...models].sort(
    (a, b) =>
      (parseModelMeta(b.Data.Meta).sortWeight ?? 0) -
      (parseModelMeta(a.Data.Meta).sortWeight ?? 0),
  );

  return (
    <>
      <ShopBar provider={provider} />
      <div className="relative">
        {/* 页面环境光 — 左上柔光 */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(50%_80%_at_18%_0%,rgba(255,255,255,0.05),transparent_70%)]" />
        <div className="relative mx-auto grid w-full max-w-5xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-8">
          {/* 左栏 — 店铺档案（身份 + 数据） */}
          <aside className="min-w-0 space-y-4">
            <IdentityCard
              id={Number(id)}
              provider={provider}
              modelCount={models.length}
              isOwner={isOwner}
              onManage={() => setManageOpen(true)}
              onOpenUsage={() => setUsageOpen(true)}
            />
          </aside>

          {/* 右栏 — 内容流（商品卡片 + 使用方式） */}
          <div className="min-w-0 space-y-8">
            {sortedModels.length === 0 ? (
              <StateBlock
                title={t("minishop.shop.no_products", "该店铺还没有上架算力商品")}
                desc={t("minishop.shop.no_products_desc", "店主上架后，商品会实时出现在这里。")}
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {sortedModels.map((m) => (
                  <ModelCard
                    key={m.ID}
                    model={m.Data}
                    id={Number(m.ID)}
                    onDetail={setDetailId}
                    providerName={provider.Name}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <ShopManageModal
        open={manageOpen}
        onOpenChange={setManageOpen}
        id={Number(id)}
        address={address ?? undefined}
      />
      <UsageModal open={usageOpen} onOpenChange={setUsageOpen} />
      <ModelDetailModal
        open={detailId != null}
        onOpenChange={(o) => {
          if (!o) setDetailId(null);
        }}
        id={detailId ?? undefined}
      />
    </>
  );
}

/* ── shop manage modal — 店铺管理（tab 布局，操作走二次 modal） ─────── */

function ShopManageModal({
  open,
  onOpenChange,
  id,
  address,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  id: number;
  address: string | undefined;
  }) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="h-[85vh]"
        title={t("minishop.shop.manage_title", "店铺管理")}
        eyebrow={t("minishop.shop.seller_eyebrow", "Seller · 卖家中心")}
      >
        <Dashboard id={id} address={address} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

/* ── layout shell ─────────────────────────────────────────────────────── */

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">{children}</div>;
}
