// SSR runner：导入 Vite --ssr 构建产物（dist-ssr/server.js），起 HTTP 服务。
// 生产部署：nginx/CDN 静态托管 dist/（client assets）与 public/；本服务只处理 HTML（SSR）。
// 所有非静态路径走 renderPage（SPA 兜底）；需要精确回退时由 nginx try_files 处理。
import {
    renderPage,
    metaTags,
    computeMeta,
    seoSitemap,
    seoRobots,
    seoShareCard,
} from "../../dist-ssr/server.js";

// Accept-Language → i18n 语言：让 SSR 出与用户/爬虫语言一致的页面（双语 SEO + 避免 hydration 文本 mismatch）
function negotiateLocale(req: Request): string | undefined {
    const raw = req.headers.get("accept-language") ?? "";
    for (const part of raw.split(",")) {
        const lang = part.split(";")[0]?.trim().toLowerCase();
        if (!lang) continue;
        if (lang.startsWith("zh")) return "zh";
        if (lang.startsWith("ru")) return "ru";
        if (lang.startsWith("ja")) return "ja";
        if (lang.startsWith("ko")) return "ko";
        if (lang.startsWith("de")) return "de";
        if (lang.startsWith("en")) return "en";
    }
    return undefined; // 无匹配 → renderPage 回退 DEFAULT_LOCALE
}
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

// 本地开发：runner 同时静态托管 client 构建产物（dist/）与 public/，
// 否则 /assets/*.js 会落入 SPA 兜底返回 text/html，浏览器 MIME 校验拦截。
// 生产环境由 nginx/CDN 静态托管 dist/，此检查未命中时无副作用。
const distDir = path.resolve(new URL("../../dist", import.meta.url).pathname);
const publicDir = path.resolve(new URL("../../public", import.meta.url).pathname);

const MIME: Record<string, string> = {
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".css": "text/css",
    ".html": "text/html; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".ico": "image/x-icon",
    ".json": "application/json",
    ".txt": "text/plain",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
};

// 部署路径前缀（如 /shops）：CDN 按完整路径回源时，先剥前缀再路由；
// 若 nginx/CDN 已自行剥掉，则不设 BASE_PREFIX（空值 = 无前缀）。
const sitePrefix = (process.env.BASE_PREFIX ?? "").replace(/\/+$/, "");

function stripPrefix(urlPath: string): string {
    if (sitePrefix && urlPath.startsWith(sitePrefix)) {
        const rest = urlPath.slice(sitePrefix.length);
        return rest === "" ? "/" : rest;
    }
    return urlPath;
}

// gzip 压缩缓存：Bun 的自动压缩对 Uint8Array body 不生效，静态文件手动 gzip（asset 内容不变，进程内缓存安全）。
// 跨境链路上 1.4MB chunk 不压缩几乎必被截断，gzip 后 ~500KB 显著降低断连概率。
const gzCache = new Map<string, Uint8Array>();

function gzipBytes(full: string, raw: Uint8Array): Uint8Array {
    let gz = gzCache.get(full);
    if (!gz) {
        gz = new Uint8Array(zlib.gzipSync(raw));
        gzCache.set(full, gz);
    }
    return gz;
}

function staticFile(urlPath: string, acceptGzip: boolean): Response | null {
    const p = urlPath.startsWith("/") ? urlPath.slice(1) : urlPath;
    if (!p || p.includes("..")) return null;
    // 候选：原路径 + 去掉首段（兼容 VITE_BASE 前缀，如 /shops/assets/x.js → assets/x.js）
    const candidates = [p, p.split("/").slice(1).join("/")].filter(Boolean);
    for (const root of [distDir, publicDir]) {
        const rootResolved = path.resolve(root);
        for (const rel of candidates) {
            const full = path.resolve(root, rel);
            if (!full.startsWith(rootResolved)) continue;
            try {
                if (fs.statSync(full).isFile()) {
                    const ext = path.extname(full).toLowerCase();
                    const raw = fs.readFileSync(full);
                    // .html 不参与 hash 版本化（如 /oauth/callback.html）：用短缓存（与 SSR 页面一致），
                    // 避免 Content-Type/内容变更被长缓存锁死；assets/ 等带 hash 资源仍 immutable 长缓存。
                    const isHtml = ext === ".html" || ext === ".htm";
                    const headers: Record<string, string> = {
                        "content-type": MIME[ext] ?? "application/octet-stream",
                        "cache-control": isHtml
                            ? "public, max-age=300"
                            : "public, max-age=31536000, immutable",
                    };
                    // 文本类资源且客户端接受 gzip：压缩返回（JS/CSS 压缩率 ~70%）
                    if (acceptGzip && ".js.mjs.css.svg.json.txt".includes(ext)) {
                        headers["content-encoding"] = "gzip";
                        headers["vary"] = "Accept-Encoding";
                        return new Response(gzipBytes(full, new Uint8Array(raw)), { headers });
                    }
                    return new Response(raw, { headers });
                }
            } catch {
                /* 不存在 → 下一候选 */
            }
        }
    }
    return null;
}

export async function handlePath(pathname: string, req?: Request): Promise<Response> {
    const html = await renderPage(pathname, req ? negotiateLocale(req) : undefined);
    return new Response(html, {
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" },
    });
}

if (import.meta.main) {
    const port = Number(process.env.PORT || 3000);
    const { serve } = await import("bun");
    serve({
        port,
        fetch(req) {
            const url = new URL(req.url);
            const pathname = stripPrefix(url.pathname);
            // 健康检查（部署验证 / CDN 回源健康检查）
            if (pathname === "/health") {
                return Response.json({ ok: true, service: "minishop-ssr" });
            }
            // SEO 端点（原 share-server 职责）：sitemap / robots / 店铺分享卡
            if (pathname === "/sitemap.xml") return seoSitemap();
            if (pathname === "/robots.txt") return seoRobots();
            const card = /^\/share\/(\d+)\.svg$/.exec(pathname);
            if (card) return seoShareCard(Number(card[1]));

            const file = staticFile(pathname, (req.headers.get("accept-encoding") ?? "").includes("gzip"));
            if (file) return file;
            return handlePath(pathname, req);
        },
    });
}

// 单文件验证：`bun run src/ssr/runner.ts` 不带 PORT 时仅打印 Home/ShopDetail 关键片段
if (!import.meta.main && typeof process !== "undefined") {
    const home = await handlePath("/");
    const homeHtml = await home.text();
    console.log("=== Home (/) ===");
    console.log("status:", home.status, "length:", homeHtml.length);
    console.log("title:", homeHtml.match(/<title>([^<]*)<\/title>/)?.[1]);
    console.log("has og:title:", homeHtml.includes('property="og:title"'));
    console.log("has react root:", homeHtml.includes('id="root"'));

    const shop = await handlePath("/1");
    const shopHtml = await shop.text();
    console.log("\n=== ShopDetail (/1) ===");
    console.log("status:", shop.status, "length:", shopHtml.length);
    console.log("title:", shopHtml.match(/<title>([^<]*)<\/title>/)?.[1]);
    console.log("has og:image:", shopHtml.includes('property="og:image"'));
    console.log("shop content present:", shopHtml.includes("算力") || shopHtml.includes("Shop"));
}
