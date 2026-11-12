import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useWeb3Auth } from "@wetee/web3auth/react";
import { useShopList, useMyProvider, gateway } from "@/hooks/useShops";
import { ShopCard } from "./ShopCard";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { SectionLabel, StateBlock } from "@/ui/kit";
import { useTranslation } from "react-i18next";

const PAGE_SIZE = 12;
/**
 * 搜索窗口：链上 listActiveProviders 无搜索参数，取前 N 家客户端过滤。
 * 该值同时用于 UI 文案插值（no_results_desc 的 {{count}}），勿在文案里另写死数字。
 */
export const SEARCH_WINDOW = 100;

/**
 * 首页「全部店铺」区块 — 平台店铺列表。
 * - 浏览全部店铺（链上 listActiveProviders 分页读取），未登录也可看
 * - 搜索：链上无搜索参数，取前 SEARCH_WINDOW 家客户端按名称/简介过滤
 * - 卡片点击进入店铺详情页（/:id）；「注册店铺」入口 → /open
 * - 分页以「本页是否满页」推断是否还有下一页（与列表同源，不取含停用店铺的 total）
 */
export function ShopList() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const searching = query.trim().length > 0;

  // 当前钱包是否已有店铺（与首页 Landing 同口径）：有则入口直接进店，不再引导注册
  const { address } = useWeb3Auth();
  const { data: myProviderRaw } = useMyProvider(address ?? undefined);
  const myId = myProviderRaw
    ? Number(String(myProviderRaw).replace(/,/g, ""))
    : null;
  const hasShop = myId != null && myId > 0;

  const listQuery = useShopList(page, PAGE_SIZE);

  // 搜索模式：拉一个较大窗口后客户端过滤
  const searchQuery = useQuery({
    queryKey: ["minishop", "shopSearchWindow"],
    queryFn: async () => (await gateway()).listActiveProviders(0, SEARCH_WINDOW),
    enabled: searching,
    staleTime: 30_000,
  });

  const results = useMemo(() => {
    if (!searching) return null;
    const q = query.trim().toLowerCase();
    return (searchQuery.data ?? []).filter((p) => {
      const name = (p.Data.Name ?? "").toLowerCase();
      const desc = (p.Data.Description ?? "").toLowerCase();
      return name.includes(q) || desc.includes(q);
    });
  }, [searching, query, searchQuery.data]);

  const { providers, hasMore } =
    listQuery.data ?? { providers: [], hasMore: false };

  // 店铺入口按钮 — 头部与空态复用（与首页 Landing 一致：已有店铺 → 「去我的店铺」，否则「注册店铺」）
  const registerButton = (
    <Link to={hasShop ? `/${myId}` : "open"} className="shrink-0">
      <Button size="sm">
        {hasShop ? (
          t("minishop.home.have_shop_btn", "去我的店铺")
        ) : (
          <>
            <Plus className="size-3.5" />
            {t("minishop.shoplist.register_btn", "注册店铺")}
          </>
        )}
      </Button>
    </Link>
  );

  // 搜索分支：loading → error → 空结果 → 结果网格
  function renderSearch() {
    if (searchQuery.isLoading) {
      return (
        <StateBlock
          state="loading"
          title={t("minishop.shoplist.searching", "正在搜索店铺…")}
        />
      );
    }
    if (searchQuery.isError) {
      return (
        <StateBlock
          state="error"
          title={t("minishop.shoplist.load_failed", "店铺列表加载失败")}
          desc={t("minishop.shoplist.load_failed_desc", "链上读取异常，请稍后刷新重试。")}
        >
          <Button
            size="sm"
            variant="outline"
            onClick={() => void searchQuery.refetch()}
          >
            {t("common.retry", "重试")}
          </Button>
        </StateBlock>
      );
    }
    const list = results ?? [];
    if (list.length === 0) {
      return (
        <StateBlock
          title={t("minishop.shoplist.no_results", "没有匹配的店铺")}
          desc={t("minishop.shoplist.no_results_desc", "换个关键词试试（搜索覆盖前 {{count}} 家店铺）。", {
            count: SEARCH_WINDOW,
          })}
        />
      );
    }
    return (
      <>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => (
            <ShopCard key={String(p.ID)} shop={p} />
          ))}
        </div>
        <p className="num mt-3 text-[11px] text-white/30">
          {t("minishop.shoplist.search_results", "{{count}} 家匹配店铺", {
            count: list.length,
          })}
        </p>
      </>
    );
  }

  // 列表分支：loading → error → 越界空页 → 全空 → 网格 + 分页
  function renderList() {
    if (listQuery.isLoading) {
      return (
        <StateBlock
          state="loading"
          title={t("minishop.shoplist.loading", "正在读取店铺列表…")}
        />
      );
    }
    if (listQuery.isError) {
      return (
        <StateBlock
          state="error"
          title={t("minishop.shoplist.load_failed", "店铺列表加载失败")}
          desc={t("minishop.shoplist.load_failed_desc", "链上读取异常，请稍后刷新重试。")}
        >
          <Button
            size="sm"
            variant="outline"
            onClick={() => void listQuery.refetch()}
          >
            {t("common.retry", "重试")}
          </Button>
        </StateBlock>
      );
    }
    // 当前页越界（数据刷新后在售店铺数变小 / 翻到空页）：单独提示 + 回第一页
    if (providers.length === 0 && page > 1) {
      return (
        <StateBlock
          title={t("minishop.shoplist.page_empty", "这一页没有店铺")}
          desc={t("minishop.shoplist.page_empty_desc", "店铺数据可能已更新，回到第一页查看。")}
        >
          <Button size="sm" variant="outline" onClick={() => setPage(1)}>
            {t("minishop.shoplist.back_to_first", "回到第一页")}
          </Button>
        </StateBlock>
      );
    }
    if (providers.length === 0) {
      return (
        <StateBlock
          title={t("minishop.shoplist.empty", "还没有店铺")}
          desc={t("minishop.shoplist.empty_desc", "成为第一家：注册你的算力店铺。")}
        >
          {registerButton}
        </StateBlock>
      );
    }
    return (
      <>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map((p) => (
            <ShopCard key={String(p.ID)} shop={p} />
          ))}
        </div>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="size-3.5" />
            {t("common.previous", "上一页")}
          </Button>
          <span className="num px-2 text-[12px] text-white/50">
            {t("minishop.shoplist.page", "第 {{page}} 页", { page })}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={!hasMore}
            onClick={() => setPage((p) => p + 1)}
          >
            {t("common.next", "下一页")}
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </>
    );
  }

  return (
    <section id="shops" className="border-t border-white/10 py-6 pt-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <SectionLabel
            index="02"
            title={t("minishop.shoplist.title", "全部店铺")}
          />
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-white/40">
            {t("minishop.shoplist.desc", "平台上的算力店铺，全部注册在链上。点击卡片进入店铺，浏览算力商品；也可以注册自己的店铺。")}
          </p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="relative flex-1 sm:w-64 sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-white/30" />
            <Input
              className="h-9 pl-9 text-[13px]"
              placeholder={t("minishop.shoplist.search_placeholder", "搜索店铺名称 / 简介…")}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>
          {registerButton}
        </div>
      </div>

      <div className="mt-6">{searching ? renderSearch() : renderList()}</div>
    </section>
  );
}
