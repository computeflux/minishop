import {
  getProvider,
  listActiveProviders,
  listProviderModels,
  type ProviderInfo,
} from "./chain";
import { renderShopPage, renderFallbackPage } from "./render";
import { buildShareSvg, logoToInlineDataUrl } from "./shareCard";
import { buildSitemapXml, buildRobots } from "./sitemap";
import { serve } from "bun";

// ── 工具 ────────────────────────────────────────────────────────
function origin(req: Request): string {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  if (!host) return "http://localhost:3000";
  return `${proto}://${host}`;
}

function respond(
  body: BodyInit,
  { status = 200, contentType = "text/html; charset=utf-8", maxAge = 3600 }: { status?: number; contentType?: string; maxAge?: number } = {},
): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": contentType,
      "cache-control": `public, max-age=${maxAge}`,
      "access-control-allow-origin": "*", // og:image 跨域可取
    },
  });
}

// ── 店铺内容页 ──────────────────────────────────────────────────
async function shopPage(id: string, req: Request): Promise<Response> {
  const base = origin(req);
  const ctx = {
    canonicalUrl: `${base}/share/${id}.html`,
    shareImageUrl: `${base}/share/${id}.svg`,
    appUrl: `${base}/#/${id}`, // 交互应用（HashRouter）
    shopId: id,
    siteName: "ComputeFlux Shop",
  };

  let provider: ProviderInfo | undefined;
  try {
    const raw = await getProvider(Number(id));
    if (raw && typeof raw === "object") provider = raw as ProviderInfo;
  } catch {
    provider = undefined;
  }

  if (!provider || !provider.Name) {
    return respond(renderFallbackPage(ctx), { status: 404 });
  }

  let models = [];
  try {
    models = await listProviderModels(Number(id));
  } catch {
    models = [];
  }

  return respond(renderShopPage(provider, models, ctx));
}

// ── SVG 分享卡（TTL + 单飞缓存）──────────────────────────────────
const svgCache = new Map<string, Promise<string>>();
function shareSvg(id: string): Promise<string> {
  const existing = svgCache.get(id);
  if (existing) return existing;
  const p = (async () => {
    let provider: ProviderInfo | undefined;
    try {
      const raw = await getProvider(Number(id));
      if (raw && typeof raw === "object") provider = raw as ProviderInfo;
    } catch {
      provider = undefined;
    }
    if (!provider || !provider.Name) {
      return buildShareSvg({
        title: "ComputeFlux Shop",
        description: "算力店铺 · 你的算力私域",
        storeId: id,
      });
    }
    const logoData = await logoToInlineDataUrl(provider.LogoURL);
    return buildShareSvg({
      title: provider.Name,
      description: provider.Description || `${provider.Name} 的私域算力铺`,
      logoUrl: logoData || provider.LogoURL,
      storeId: id,
    });
  })();
  svgCache.set(id, p);
  return p;
}

// ── 路由（手动，无 Hono 依赖）────────────────────────────────────
const fetchHandler = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const p = url.pathname;
  try {
    if (p === "/health") return respond(JSON.stringify({ ok: true, ts: Date.now() }), { contentType: "application/json" });
    if (p === "/robots.txt") return respond(buildRobots(`${origin(req)}/sitemap.xml`), { contentType: "text/plain" });
    if (p === "/sitemap.xml") {
      let providers = [];
      try { providers = await listActiveProviders(2000); } catch { providers = []; }
      return respond(buildSitemapXml(origin(req), providers), { contentType: "application/xml" });
    }
    let m: RegExpExecArray | null;
    if ((m = /^\/share\/(\w+)\.html$/.exec(p))) return await shopPage(m[1], req);
    if ((m = /^\/shop\/(\w+)$/.exec(p))) return await shopPage(m[1], req); // 干净 URL 别名
    if ((m = /^\/share\/(\w+)\.svg$/.exec(p))) {
      const svg = await shareSvg(m[1]);
      return respond(svg, { contentType: "image/svg+xml" });
    }
    // SPA 回退：若配置了 SPA_INDEX，其它 GET 返回应用入口（可同一服务托管 app）
    if (req.method === "GET" && process.env.SPA_INDEX) {
      const html = await fsText(process.env.SPA_INDEX);
      return respond(html);
    }
    return new Response("Not Found", { status: 404 });
  } catch (err) {
    console.error("request error:", err);
    // 出错也返回兜底页（社交分享不会显示空白）
    try {
      return respond(renderFallbackPage({
        canonicalUrl: `${origin(req)}${p}`,
        shareImageUrl: `${origin(req)}/share/brand.svg`,
        appUrl: `${origin(req)}/`,
        siteName: "ComputeFlux Shop",
      }), { status: 500 });
    } catch {
      return new Response("Internal Server Error", { status: 500 });
    }
  }
};

async function fsText(path: string): Promise<string> {
  const fs = await import("node:fs");
  return fs.readFileSync(path, "utf8");
}

// ── 启动 ────────────────────────────────────────────────────────
const port = Number(process.env.PORT) || 3000;

if (import.meta.main) {
  serve({ fetch: fetchHandler, port }, (server) =>
    console.log(`share-server listening on http://localhost:${server.port}`),
  );
}

export { fetchHandler };
