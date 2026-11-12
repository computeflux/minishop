import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/ui/button";
import { StateBlock } from "@/ui/kit";
import { useShop } from "@/hooks/useShops";
import { cn } from "@/shared/lib/utils";
import { useTranslation } from "react-i18next";
import { OverviewTab } from "./OverviewTab";
import { ModelsTab } from "./ModelsTab";
import { RevenueTab } from "./RevenueTab";
import { BalanceTab } from "./BalanceTab";

const TABS = [
  { id: "overview", label: "概览" },
  { id: "models", label: "算力商品" },
  { id: "revenue", label: "收益记录" },
  { id: "balance", label: "余额提现" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** 页面布局壳（/my-shop 页面与 Dashboard 共用） */
export function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-4 sm:px-6">{children}</div>
  );
}

/**
 * 卖家后台主体 — tab 布局。
 * /my-shop 页面与店铺页的"店铺管理"弹窗共用此组件；
 * tab 内的操作（发布商品 / 提现等）走二次 modal。
 */
export function Dashboard({
  id,
  address,
  onClose,
}: {
  id: number;
  address: string | undefined;
  /** modal 上下文提供：关闭外层 modal（店铺页内“查看店铺页”） */
  onClose?: () => void;
}) {
  const { data, isLoading, isError } = useShop(id);
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const tab: TabId = (TABS.find((item) => item.id === params.get("tab"))?.id ??
    "overview") as TabId;
  const tabLabels: Record<TabId, string> = {
    overview: t("minishop.seller.tab_overview", "概览"),
    models: t("minishop.shop.products", "算力商品"),
    revenue: t("minishop.seller.tab_revenue", "收益记录"),
    balance: t("minishop.seller.tab_balance", "余额提现"),
  };

  if (isLoading)
    return (
      <Page>
        <StateBlock state="loading" title={t("minishop.shop.reading", "正在读取店铺…")} />
      </Page>
    );
  if (isError || !data)
    return (
      <Page>
        <StateBlock state="error" title={t("minishop.seller.shop_load_failed", "店铺加载失败。")}>
          <Link to="/">
            <Button size="sm" variant="outline">{t("minishop.common.back_home", "返回首页")}</Button>
          </Link>
        </StateBlock>
      </Page>
    );

  return (
    <>
      {/* Tabs */}
      <div className="flex gap-8 mb-5 overflow-x-auto overflow-y-hidden border-b border-white/10">
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() =>
                setParams(active ? {} : { tab: item.id }, { replace: true })
              }
              className={cn(
                "relative shrink-0 px-0.5 pb-3 text-sm transition-colors",
                active
                  ? "text-white"
                  : "text-white/40 hover:text-white/70"
              )}
            >
              {tabLabels[item.id]}
              {active ? (
                <span className="absolute inset-x-0 -bottom-px h-px bg-white" />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="py-0">
        {tab === "overview" && (
          <OverviewTab
            id={id}
            onClose={onClose}
            onViewRevenue={() => setParams({ tab: "revenue" }, { replace: true })}
          />
        )}
        {tab === "models" && <ModelsTab id={id} />}
        {tab === "revenue" && <RevenueTab id={id} />}
        {tab === "balance" && <BalanceTab id={id} address={address} />}
      </div>
    </>
  );
}
