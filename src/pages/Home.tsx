import { Link } from "react-router-dom";
import { Wallet, ArrowUpRight } from "lucide-react";
import { useWeb3Auth, useWeb3AuthConnect } from "@wetee/web3auth/react";
import { Button } from "@/ui/button";
import { MicroLabel, Display } from "@/ui/kit";
import { useMyProvider } from "@/hooks/useShops";
import { ShopList } from "@/features/shop/ShopList";
import { DAPP_URL } from "@/shared/config/api";
import { clientOrigin } from "@/shared/utils/client";
import { useTranslation } from "react-i18next";
import { useMeta } from "@/hooks/useMeta";

/**
 * 根路由 = 私域入口 + 平台店铺列表。
 * 始终展示私域落地页（展示形式最佳，无论是否连接 / 是否已有店铺）。
 * 已拥有店铺时，在页顶显示横幅 +「去我的店铺」入口，点击跳转 /shops/{id}。
 * 下方「全部店铺」区块：浏览平台全部店铺（未登录可看）+ 注册店铺入口。
 */
export default function Home() {
  const { address, isConnected } = useWeb3Auth();
  const { t } = useTranslation();

  // 首页 SEO / 社交分享 meta（与 index.html 的静态兜底一致；文案随 i18n 语言切换）
  useMeta({
    title: t("minishop.seo.home_title"),
    description: t("minishop.seo.home_description"),
    url: `${clientOrigin()}${import.meta.env.BASE_URL}`,
  });
  const { connect, loading } = useWeb3AuthConnect();
  const { data: myProviderRaw } = useMyProvider(address ?? undefined);
  const myId = myProviderRaw
    ? Number(String(myProviderRaw).replace(/,/g, ""))
    : null;

  return (
    <Landing
      connect={connect}
      connecting={loading}
      isConnected={isConnected}
      myId={myId}
    />
  );
}

/* ── 私域落地页 ─────────────────────────────────────────────────── */

function Landing({
  connect,
  connecting,
  isConnected,
  myId,
}: {
  connect: () => void;
  connecting: boolean;
  isConnected: boolean;
  myId: number | null;
}) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
      <section className="pb-16 pt-16 sm:pt-24">
        <MicroLabel>{t("minishop.home.tagline", "ComputeFlux · 算力小铺")}</MicroLabel>
        <Display className="mt-6 max-w-2xl text-4xl sm:text-5xl">
          {t("minishop.home.heading_1", "算力店铺，")}
          <br />
          {t("minishop.home.heading_2", "你的算力私域。")}
        </Display>
        <p className="mt-6 max-w-xl text-sm leading-relaxed text-white/45">
          {t("minishop.home.subtitle", "这是单个算力提供者的专属店铺：上架你的模型、设定价格与端点，把店铺链接分享到你的私域。买家进来充值积分、按需调用、链上结算。浏览全部店铺与模型，请去公域市场。")}
        </p>
        {/*<div className="mt-10 flex flex-wrap items-center gap-3">
          {!isConnected ? (
            <Button size="lg" onClick={connect} disabled={connecting}>
              <Wallet className="size-4" />
              {connecting
                ? t("minishop.common.connecting", "连接中…")
                : t("minishop.common.connect", "连接钱包")}
            </Button>
          ) : null}
          {myId != null && myId > 0 ? (
            <Link to={`/${myId}`}>
              <Button size="lg">{t("minishop.home.have_shop_btn", "去我的店铺")}</Button>
            </Link>
          ) : (
            <Link to="open">
              <Button size="lg" variant="outline">
                {t("minishop.shop.open_shop_btn", "开设算力小铺")}
              </Button>
            </Link>
          )}
          {DAPP_URL ? (
            <a href={DAPP_URL} target="_blank" rel="noreferrer">
              <Button size="lg" variant="ghost">
                {t("minishop.nav.public_market", "公域市场")}
                <ArrowUpRight className="size-4" />
              </Button>
            </a>
          ) : null}
        </div>*/}
      </section>

      {/* 三步闭环 */}
      {/*<div className="grid gap-px border border-white/10 bg-white/10 sm:grid-cols-3">
          {[
            { n: "01", t: t("minishop.home.step1_title", "开店上架"), d: t("minishop.home.step1_desc", "店铺与算力商品注册到链上，价格、端点、并发一目了然。") },
            { n: "02", t: t("minishop.home.step2_title", "分享私域"), d: t("minishop.home.step2_desc", "复制店铺链接，发到你的社群、主页与任何私域渠道。") },
            { n: "03", t: t("minishop.home.step3_title", "按量结算"), d: t("minishop.home.step3_desc", "买家充值积分、调用即扣费，每一笔结算都上链可查。") },
          ].map((s) => (
          <div key={s.n} className="bg-black px-6 py-5">
            <div className="flex items-baseline gap-2">
              <span className="num text-[11px] text-white/30">{s.n}</span>
              <span className="text-[13px] font-medium text-white">{s.t}</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-white/40">{s.d}</p>
          </div>
        ))}
      </div>*/}

      {/* 平台店铺列表（浏览全部店铺 + 注册店铺入口） */}
      <ShopList />
    </div>
  );
}
