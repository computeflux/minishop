import { renderToReadableStream } from "react-dom/server";
import { StaticRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider, dehydrate } from "@tanstack/react-query";
import i18n, { ogLocale, htmlLang } from "@/i18n";
// SSR 构建时 @wetee/web3auth/react 经 alias 指向存根（no-op provider + 断开默认值 hooks）。
import { Web3AuthProvider } from "@wetee/web3auth/react";
import { SsrApp } from "./SsrApp";
import { fetchShop } from "@/hooks/useShops";
import { shareImageUrl, buildShareSvg } from "@/lib/share";
import { GatewayContractApi } from "@/contracts/tee/gateway";
import { DAPP_URL } from "@/shared/config/api";
import fs from "node:fs";
import path from "node:path";
import type { ManifestEntry } from "./manifest";

/**
 * SSR 服务端渲染入口（Vite --ssr 构建产物）。
 * 仅渲染 SEO 页面：Home（/）与 ShopDetail（/:id）。其余路由回退到通用 meta。
 *
 * 客户端 hydration 由 client 构建的 main.tsx 负责（检测 window.__SSR__ 后 hydrateRoot）。
 * 入口 JS / preload / CSS 由 loadClientAssets() 经 client manifest 精确注入 <head>。
 */

// 站点 origin（服务端，用于构建绝对 URL；CDN/上游可覆盖 SITE_URL）
const SITE_URL = process.env.SITE_URL?.replace(/\/$/, "") ?? "";

/** 读取客户端构建的 Vite manifest，生成入口 JS / preload / CSS 引用。
 *  部署时 dist-ssr 与 dist 同级：manifest 默认在 ../dist/.vite/manifest.json（CLIENT_MANIFEST_PATH 可覆盖）。 */
let cachedAssets: string | null = null;
function loadClientAssets(): string {
    if (cachedAssets !== null) return cachedAssets;
    const manifestPath =
        process.env.CLIENT_MANIFEST_PATH ??
        new URL("../dist/.vite/manifest.json", import.meta.url).pathname;
    try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
        const key = Object.keys(manifest).find((k) => k.endsWith("index.html"));
        const entry = key ? (manifest[key] as ManifestEntry) : undefined;
        const base = import.meta.env.BASE_URL;
        const tags: string[] = [];
        if (entry?.css) for (const c of entry.css) tags.push(`<link rel="stylesheet" crossorigin href="${base}${c}" />`);
        if (entry?.file) tags.push(`<script type="module" crossorigin src="${base}${entry.file}"></script>`);
        // Rolldown manifest 的 imports 带一个前导 `_`（如 _ccip-wZjfwcwz.js → 实际 assets/ccip-wZjfwcwz.js），需还原。
        if (entry?.imports) for (const i of entry.imports) tags.push(`<link rel="modulepreload" crossorigin href="${base}assets/${i.replace(/^_/, "")}" />`);
        cachedAssets = tags.join("\n    ");
    } catch {
        // manifest 缺失时回退占位（部署后应不存在）
        cachedAssets = `<script type="module" crossorigin src="${SITE_URL}${import.meta.env.BASE_URL}assets/index.js"></script>`;
    }
    return cachedAssets;
}

interface MetaInfo {
    title: string;
    description: string;
    imageUrl?: string;
    url: string;
}

function basePrefix(): string {
    return `${SITE_URL}${import.meta.env.BASE_URL}`;
}

/** 按路由 + 店铺数据计算 SEO meta（服务端注入 <head>；文案随 i18n 语言，由 renderPage 先 changeLanguage 决定）。 */
export async function computeMeta(pathname: string): Promise<MetaInfo> {
    const base = basePrefix();
    if (pathname === "/" || pathname === "") {
        return {
            title: i18n.t("minishop.seo.home_title"),
            description: i18n.t("minishop.seo.home_description"),
            imageUrl: `${base}og-brand.svg`,
            url: base,
        };
    }
    const idMatch = pathname.match(/^\/(\d+)$/);
    if (idMatch) {
        const id = Number(idMatch[1]);
        let data: Awaited<ReturnType<typeof fetchShop>> = null;
        try {
            data = await fetchShop(id, true);
        } catch {
            // 店铺不存在/解码异常：回退通用 meta（页面仍正常渲染兜底状态）
            data = null;
        }
        const name = data?.provider?.Name;
        return {
            title: name
                ? `${name} · ${i18n.t("minishop.seo.shop_title_suffix")}`
                : `ComputeFlux Shop · ${i18n.t("minishop.seo.shop_title_suffix")}`,
            description: data?.provider?.Description
                ? i18n.t("minishop.seo.shop_description_with", { name, desc: data.provider.Description })
                : i18n.t("minishop.seo.shop_description_fallback", { name: name ?? "ComputeFlux Shop" }),
            imageUrl: data ? shareImageUrl(id) : undefined,
            url: `${base}${id}`,
        };
    }
    return {
        title: i18n.t("minishop.seo.fallback_title"),
        description: i18n.t("minishop.seo.fallback_description"),
        imageUrl: `${base}og-brand.svg`,
        url: base,
    };
}

function escapeAttr(s: string | undefined): string {
    return (s ?? "").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** 把 meta 渲染为 <head> 标签串。 */
export function metaTags(m: MetaInfo): string {
    return [
        `<title>${escapeAttr(m.title)}</title>`,
        `<meta name="description" content="${escapeAttr(m.description)}" />`,
        `<link rel="canonical" href="${escapeAttr(m.url)}" />`,
        `<meta property="og:title" content="${escapeAttr(m.title)}" />`,
        `<meta property="og:description" content="${escapeAttr(m.description)}" />`,
        `<meta property="og:type" content="website" />`,
        `<meta property="og:url" content="${escapeAttr(m.url)}" />`,
        m.imageUrl ? `<meta property="og:image" content="${escapeAttr(m.imageUrl)}" />` : "",
        `<meta property="og:image:alt" content="${escapeAttr(m.title)}" />`,
        `<meta property="og:site_name" content="ComputeFlux Shop" />`,
        `<meta property="og:locale" content="${ogLocale()}" />`,
        `<meta name="twitter:card" content="summary_large_image" />`,
        `<meta name="twitter:title" content="${escapeAttr(m.title)}" />`,
        `<meta name="twitter:description" content="${escapeAttr(m.description)}" />`,
        m.imageUrl ? `<meta name="twitter:image" content="${escapeAttr(m.imageUrl)}" />` : "",
    ].join("\n    ");
}

// ── SEO 端点（原 share-server 职责并入：sitemap / robots / 店铺分享卡）──────────────

// 链读取缓存：sitemap 每 5 分钟最多读一次链（店铺新增不频繁）；分享卡 1h。
const SITEMAP_CACHE_MS = Number(process.env.SITEMAP_CACHE_MS || 300_000);
const CARD_CACHE_MS = Number(process.env.CARD_CACHE_MS || 3_600_000);
let sitemapCache: { at: number; body: string } | null = null;
const cardCache = new Map<number, { at: number; body: string }>();

function escapeXml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function buildSitemapBody(): Promise<string> {
    const base = basePrefix();
    const locs: string[] = [base.replace(/\/$/, "")]; // 首页
    try {
        const limit = 100;
        for (let offset = 0; offset < 5000; offset += limit) {
            const page = await GatewayContractApi.listActiveProviders(offset, limit);
            for (const p of page ?? []) locs.push(`${base}${p.ID}`);
            if (!page || page.length < limit) break;
        }
    } catch (e) {
        console.error("[ssr] sitemap: 读取在售店铺列表失败，仅含首页", e);
    }
    const lastmod = new Date().toISOString().slice(0, 10);
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        locs.map((loc) => `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`).join("\n") +
        `\n</urlset>`;
}

export async function seoSitemap(): Promise<Response> {
    if (!sitemapCache || Date.now() - sitemapCache.at > SITEMAP_CACHE_MS) {
        sitemapCache = { at: Date.now(), body: await buildSitemapBody() };
    }
    return new Response(sitemapCache.body, {
        headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=3600",
        },
    });
}

export function seoRobots(): Response {
    const base = basePrefix();
    const body = `User-agent: *\nAllow: /\n\nSitemap: ${base.replace(/\/$/, "")}/sitemap.xml\n`;
    return new Response(body, {
        headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "public, max-age=86400",
        },
    });
}

/** 店铺分享卡 SVG（og:image）：链上店名 + logo + 简介 + 品牌水印；读取失败回退品牌图。 */
export async function seoShareCard(id: number): Promise<Response> {
    const hit = cardCache.get(id);
    if (hit && Date.now() - hit.at < CARD_CACHE_MS) {
        return new Response(hit.body, { headers: cardHeaders() });
    }
    let data: Awaited<ReturnType<typeof fetchShop>> = null;
    try {
        data = await fetchShop(id, true);
    } catch {
        data = null;
    }
    const name = data?.provider?.Name;
    const body = name
        ? buildShareSvg({
              title: name,
              description: data!.provider.Description || i18n.t("minishop.seo.fallback_description"),
              logoUrl: data!.provider.LogoURL || undefined,
              storeId: id,
          })
        : fs.readFileSync(path.resolve(process.cwd(), `public/og-brand.svg`), "utf-8");
    if (cardCache.size > 500) cardCache.delete(cardCache.keys().next().value!); // 简易 LRU 上限
    cardCache.set(id, { at: Date.now(), body });
    return new Response(body, { headers: cardHeaders() });
}

function cardHeaders() {
    return {
        "content-type": "image/svg+xml",
        "cache-control": "public, max-age=3600",
        "access-control-allow-origin": "*",
    };
}

/** 渲染单个路径的完整 HTML 文档。locale 优先（runner 从 Accept-Language 解析），否则用 DEFAULT_LOCALE。 */
export async function renderPage(pathname: string, locale?: string): Promise<string> {
    await i18n.changeLanguage(locale || process.env.DEFAULT_LOCALE || "en");

    const queryClient = new QueryClient({
        defaultOptions: { queries: { staleTime: 60_000, retry: false, cacheTime: 60_000 } },
    });
    const meta = await computeMeta(pathname);

    // SSR 预取：把店铺数据注入 query client（ShopDetail 渲染时直接取到，避免 flash loading）
    const idMatch = pathname.match(/^\/(\d+)$/);
    if (idMatch) {
        const id = Number(idMatch[1]);
        await queryClient.prefetchQuery({
            queryKey: ["minishop", "shop", id, "active"],
            queryFn: () => fetchShop(id, true),
        });
    }

    const dehydrated = dehydrate(queryClient);

    // 用 renderToReadableStream：SsrApp 静态导入页面（无 lazy/Suspense），避免异步边界触发
    // 该 Bun 版本 renderToReadableStream 的关闭 bug。服务端拿到完整 HTML。
    const stream = await renderToReadableStream(
        <StaticRouter location={pathname}>
            <QueryClientProvider client={queryClient}>
                {/* web3auth 存根 provider（SSR alias）：no-op，hooks 返回断开默认值 */}
                <Web3AuthProvider>
                    <SsrApp />
                </Web3AuthProvider>
            </QueryClientProvider>
        </StaticRouter>,
    );
    // ReadableStream 无 arrayBuffer()：经 Response 读取为 ArrayBuffer。
    const buffer = await new Response(stream).arrayBuffer();
    const appHtml = new TextDecoder().decode(buffer);

    return `<!DOCTYPE html>
<html lang="${htmlLang()}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    ${metaTags(meta)}
    <link rel="icon" type="image/svg+xml" href="${import.meta.env.BASE_URL}favicon.svg" />
    ${loadClientAssets()}
  </head>
  <body>
    <div id="root">${appHtml}</div>
    <script>window.__QUERY_STATE__=${JSON.stringify(dehydrated)};</script>
    <script>window.__SSR__=true;</script>
  </body>
</html>`;
}

// ── 导出供 runner 使用 ────────────────────────────────────────────────
// runner 负责 HTTP：读取请求 pathname → renderPage() → 返回 HTML。
// （Vite --ssr 构建产物 dist-ssr/index.js 由 runner 导入；开发期 runner 可直接 import 本源码。）
