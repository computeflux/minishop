/**
 * 社交分享卡（Open Graph / Twitter Card 图片）。
 *
 * 分享链接到 Telegram / X / 微信时，平台会抓取 og:image 生成预览卡片。
 * 这里用纯 SVG 生成一张 1200×630 的卡片（OG 标准尺寸），
 * 包含店铺名 + logo + 简介 + 品牌水印，无需任何图片库 / 后端。
 *
 * 注意：SVG 内 `<image>` 引用的是外部 logo URL（IPFS/http）。
 * 能跑 JS 的爬虫（Telegram、部分 X 预览）会解析它；
 * 若需「微信服务器」也稳定渲染 logo，需把 logo 内联为 base64（见 inlineLogo）。
 */

export interface ShareCardData {
  title: string; // 店铺名 / og:title
  description: string; // 简介 / og:description
  logoUrl?: string; // 店铺 logo URL（可选）
  storeId?: string | number; // 店铺 id（可选，显示在角标）
  brand?: string; // 品牌名，默认 ComputeFlux Shop
}

/** SVG 文本转义 */
function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 截断 + 省略号 */
function truncate(s: string, n: number): string {
  const t = String(s).trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

/** 把外部 logo URL 内联为 base64 占位（调用方需先 fetch 转 base64） */
export function inlineLogo(base64DataUrl: string): string {
  return `<image href="${esc(base64DataUrl)}" x="40" y="40" width="72" height="72" preserveAspectRatio="xMidYMid meet" />`;
}

/**
 * 生成分享卡片 SVG。
 * logo 失败时回退为「店铺名首字」的色块，保证卡片不空。
 */
export function buildShareSvg(d: ShareCardData): string {
  const { title, description, logoUrl, storeId, brand = "ComputeFlux Shop" } = d;
  const name = truncate(title, 32);
  const desc = truncate(description, 88);
  const nameY = 168;

  // logo：有 URL 则引用外部图，否则用首字色块
  let logoNode: string;
  if (logoUrl) {
    logoNode = `<image href="${esc(logoUrl)}" x="40" y="40" width="72" height="72" preserveAspectRatio="xMidYMid meet" onerror="this.display='none'" />`;
  } else {
    const letter = esc(truncate(title, 1) || "M");
    logoNode = `
      <rect x="40" y="40" width="72" height="72" rx="16" fill="#ffffff" />
      <text x="76" y="92" text-anchor="middle" font-size="44" font-weight="700" fill="#000" font-family="system-ui, sans-serif">${letter}</text>`;
  }

  const idBadge = storeId != null
    ? `<rect x="1000" y="60" width="160" height="44" rx="22" fill="rgba(255,255,255,0.12)" />
       <text x="1080" y="89" text-anchor="middle" font-size="22" font-family="monospace" fill="#ffffff">#${esc(String(storeId))}</text>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b0b0d" />
      <stop offset="1" stop-color="#15151a" />
    </linearGradient>
    <radialGradient id="glow" cx="0.15" cy="0.1" r="0.8">
      <stop offset="0" stop-color="rgba(255,255,255,0.10)" />
      <stop offset="1" stop-color="rgba(255,255,255,0)" />
    </radialGradient>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)" />
  <rect width="1200" height="630" fill="url(#glow)" />
  <rect x="6" y="6" width="1188" height="618" rx="20" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="2" />

  ${logoNode}

  <text x="136" y="${nameY}" font-size="56" font-weight="700" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif">${esc(name)}</text>

  <text x="136" y="${nameY + 56}" font-size="28" fill="#ffffff" opacity="0.55" font-family="system-ui, sans-serif">${esc(desc)}</text>

  <line x1="136" y1="500" x2="1064" y2="500" stroke="rgba(255,255,255,0.15)" stroke-width="2" />
  <text x="136" y="560" font-size="30" font-weight="600" fill="#ffffff" letter-spacing="6" font-family="monospace">${esc(brand)}</text>
  <text x="1064" y="560" text-anchor="end" font-size="24" fill="#ffffff" opacity="0.4" font-family="monospace">算力小铺 · compute flux</text>

  ${idBadge}
</svg>`;
}

/**
 * 分享卡片图片 URL。
 *
 * 生产环境需要一个能返回该 SVG 的端点 `/share/{id}.svg`（见 vite 开发中间件
 * 与部署说明）；开发环境由 Vite 中间件返回。
 * og:image 必须是绝对 URL，爬虫才能抓取。
 */
export function shareImageUrl(storeId: string | number): string {
  const base = import.meta.env.BASE_URL || "/";
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${base}share/${storeId}.svg`;
}
