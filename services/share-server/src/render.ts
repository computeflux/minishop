import type { ProviderInfo, ModelWithID } from "./chain";

export interface PageCtx {
  canonicalUrl: string; // 本页面绝对 URL（og:url / canonical）
  shareImageUrl: string; // og:image 绝对 URL（/share/{id}.svg）
  appUrl: string; // 交互应用跳转地址
  shopId?: string; // 展示用店铺 id（get_provider 不带 ID，走路由 id）
  siteName?: string;
}

const SITE_NAME = "ComputeFlux Shop";

function esc(s: string): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function num(n: string | number | undefined): string {
  if (n == null || n === "") return "—";
  const v = Number(n);
  if (!Number.isFinite(v)) return String(n);
  return v.toLocaleString("en-US");
}

/** SuccessRate 链上为 1/10000 单位（10000 = 100%），这里做友好展示（>100% 视为未设，原样展示） */
function successRateRaw(r: number | undefined): string {
  if (r == null || r === 0) return "—";
  const pct = (Number(r) / 10000) * 100;
  return pct > 0 && pct <= 100 ? `${pct.toFixed(2)}%` : `${num(r)}`;
}

function regionName(r: number | undefined): string {
  // 区域编码暂无枚举映射表，原样展示；后续可在此扩展
  return r == null || r === 0 ? "未设置" : `区域 ${r}`;
}

function modelMeta(m: ModelWithID): { name: string; price: string; ctx: string; concurrency: number; active: boolean } {
  const name = esc(m.Data.Name || `模型 ${m.ID}`);
  const inPrice = num(m.Data.InPrice);
  const ctx = num(m.Data.ContextLength);
  return {
    name,
    price: `输入 ${inPrice} · 上下文 ${ctx} tok`,
    ctx,
    concurrency: Number(m.Data.MaxConcurrency) || 0,
    active: Boolean(m.Data.IsActive),
  };
}

function jsonLd(p: ProviderInfo, models: ModelWithID[], ctx: PageCtx): string {
  const items = models.map((m, i) => ({
    "@type": "ListItem",
    "position": i + 1,
    "url": `${ctx.canonicalUrl}#model-${m.ID}`,
    "name": esc(m.Data.Name || `模型 ${m.ID}`),
  }));
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": esc(p.Name),
    "description": esc(p.Description),
    "url": ctx.canonicalUrl,
    ...(p.LogoURL ? { "logo": esc(p.LogoURL) } : {}),
    "areaServed": { "@type": "Place", "name": regionName(p.Region) },
    "makesOffer": { "@type": "ItemList", "itemListElement": items },
  };
  return `<script type="application/ld+json">${esc(JSON.stringify(data))}</script>`;
}

/** 店铺内容页（SEO + 社交分享共用一页：含 og meta 与实质内容） */
export function renderShopPage(p: ProviderInfo, models: ModelWithID[], ctx: PageCtx): string {
  const siteName = ctx.siteName || SITE_NAME;
  const title = `${p.Name || SITE_NAME} · 算力店铺 — ${siteName}`;
  const description = p.Description
    ? `${p.Name} 的私域算力铺：上架模型、设定价格与端点，按需调用、链上结算。`
    : `${p.Name} 的私域算力铺，按需调用链上算力。`;

  const modelRows = models
    .map((m) => {
      const mm = modelMeta(m);
      return `<li id="model-${esc(m.ID)}" class="model ${mm.active ? "" : "disabled"}">
        <span class="model-name">${mm.name}</span>
        <span class="model-meta">${mm.price}${mm.concurrency ? ` · 并发 ${mm.concurrency}` : ""}</span>
        ${mm.active ? '<span class="badge active">在售</span>' : '<span class="badge off">已停用</span>'}
      </li>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${esc(ctx.canonicalUrl)}" />

<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${esc(ctx.canonicalUrl)}" />
<meta property="og:image" content="${esc(ctx.shareImageUrl)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="${esc(p.Name + ' 算力店铺分享卡')}" />
<meta property="og:site_name" content="${esc(siteName)}" />
<meta property="og:locale" content="zh_CN" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${esc(ctx.shareImageUrl)}" />

${jsonLd(p, models, ctx)}

<style>
  :root{ color-scheme: dark }
  *{box-sizing:border-box}
  body{margin:0;background:#0b0b0d;color:#e7e7ea;
    font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
  .wrap{max-width:760px;margin:0 auto;padding:32px 20px}
  header{display:flex;gap:16px;align-items:center;border-bottom:1px solid rgba(255,255,255,.1);padding-bottom:20px}
  .logo{width:56px;height:56px;border-radius:14px;background:#fff;color:#000;display:grid;place-items:center;
    font-weight:700;font-size:24px;flex:0 0 auto;overflow:hidden}
  .logo img{width:100%;height:100%;object-fit:cover}
  h1{font-size:26px;margin:0}
  .idbadge{font-family:monospace;color:#fff;opacity:.5;font-size:13px}
  .desc{color:#b4b4bb;margin:16px 0}
  ul.stats{list-style:none;display:flex;flex-wrap:wrap;gap:12px;padding:0;margin:0 0 24px}
  ul.stats li{background:#14141a;border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:12px 16px;flex:1 1 120px}
  .stats .k{display:block;font-size:12px;color:#7a7a82}
  .stats .v{display:block;font-size:18px;font-weight:600}
  section h2{font-size:18px;color:#fff;margin:0 0 12px}
  ul.models{list-style:none;padding:0;margin:0}
  li.model{display:flex;align-items:center;gap:12px;flex-wrap:wrap;
    background:#14141a;border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:14px 16px;margin-bottom:10px}
  li.model.disabled{opacity:.5}
  .model-name{font-weight:600;color:#fff}
  .model-meta{color:#9a9aa2;font-size:14px}
  .badge{font-size:12px;padding:2px 8px;border-radius:999px;margin-left:auto}
  .badge.active{background:#1f6f43;color:#d4f6e4}
  .badge.off{background:#3a3a44;color:#c9c9d1}
  .cta{display:inline-block;margin-top:8px;background:#fff;color:#0b0b0d;text-decoration:none;
    font-weight:600;padding:12px 20px;border-radius:10px}
  .cta:hover{text-decoration:underline}
  footer{margin-top:28px;color:#6a6a72;font-size:13px}
</style>
</head>
<body>
<main class="wrap">
  <header>
    <div class="logo">${p.LogoURL ? `<img src="${esc(p.LogoURL)}" alt="${esc(p.Name)}" onerror="this.style.display='none';this.parentNode.textContent='${esc((p.Name || "M").slice(0,1))}'" />` : esc((p.Name || "M").slice(0, 1))}</div>
    <div>
      <h1>${esc(p.Name || SITE_NAME)}</h1>
      <span class="idbadge">店铺 #${esc(ctx.shopId ?? String(p.ID ?? ""))} · ${regionName(p.Region)}</span>
    </div>
  </header>

  <p class="desc">${esc(p.Description || `${p.Name} 的私域算力铺，按需调用链上算力。`)}</p>

  <ul class="stats">
    <li><span class="k">累计请求</span><span class="v">${num(p.TotalRequests)}</span></li>
    <li><span class="k">成功率</span><span class="v">${successRateRaw(p.SuccessRate)}</span></li>
    <li><span class="k">平均延迟</span><span class="v">${num(p.AvgLatency)} ms</span></li>
    <li><span class="k">上架模型</span><span class="v">${num(models.length)}</span></li>
  </ul>

  <section>
    <h2>算力商品</h2>
    <ul class="models">${modelRows || '<li class="model"><span class="model-meta">该店铺还没有上架算力商品</span></li>'}</ul>
  </section>

  <a class="cta" href="${esc(ctx.appUrl)}">打开店铺，充值积分按需调用 →</a>

  <footer>ComputeFlux Shop · 单店私域 · 按需消费 · 结算上链</footer>
</main>
</body>
</html>`;
}

/** 店铺不存在 / 读取失败时的兜底页（仍带品牌 meta，避免空白 404） */
export function renderFallbackPage(ctx: PageCtx): string {
  const siteName = ctx.siteName || SITE_NAME;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(siteName)} — 算力店铺</title>
<meta name="description" content="任何人开设算力小铺，把闲置算力挂上链；任何人充值积分，按需调用。" />
<link rel="canonical" href="${esc(ctx.canonicalUrl)}" />
<meta property="og:title" content="${esc(siteName + " — 算力店铺")}" />
<meta property="og:description" content="任何人开设算力小铺，把闲置算力挂上链；任何人充值积分，按需调用。" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${esc(ctx.canonicalUrl)}" />
<meta property="og:image" content="${esc(ctx.shareImageUrl)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:site_name" content="${esc(siteName)}" />
<meta name="twitter:card" content="summary_large_image" />
<style>body{margin:0;background:#0b0b0d;color:#e7e7ea;font:16px/1.6 system-ui;display:grid;place-items:center;height:100vh}</style>
</head>
<body>
<main style="text-align:center;padding:20px">
  <h1>${esc(siteName)}</h1>
  <p>该店铺不存在或加载失败。</p>
  <a href="${esc(ctx.appUrl)}" style="color:#fff;">返回首页 →</a>
</main>
</body>
</html>`;
}
