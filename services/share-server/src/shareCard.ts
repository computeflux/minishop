/**
 * 社交分享卡（Open Graph / Twitter Card 图片）—— SVG 生成。
 *
 * 分享链接到 Telegram / X / 微信时，平台抓取 og:image 生成预览。
 * logo 经 base64 内联，确保微信服务器（不执行 JS、不取外链图）也能稳定渲染。
 */

export interface ShareCardData {
  title: string;
  description: string;
  logoUrl?: string;
  storeId?: string | number;
  brand?: string;
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(s: string, n: number): string {
  const t = String(s).trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

/** 把外部 logo URL 拉取并转 base64 data URL，内联进 SVG（失败回退空） */
export async function logoToInlineDataUrl(
  logoUrl: string | undefined,
): Promise<string> {
  if (!logoUrl) return "";
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return "";
    const buf = Buffer.from(await res.arrayBuffer());
    const ext = /\.png$/i.test(logoUrl) ? "png" : /\.jpe?g$/i.test(logoUrl) ? "jpeg" : "png";
    return `data:image/${ext};base64,${buf.toString("base64")}`;
  } catch {
    return "";
  }
}

/** 生成分享卡片 SVG（logo 内联 base64；失败回退首字色块） */
export function buildShareSvg(d: ShareCardData): string {
  const { title, description, storeId, brand = "ComputeFlux Shop" } = d;
  const name = truncate(title, 32);
  const desc = truncate(description, 88);
  const nameY = 168;

  const logoData = d.logoUrl ? `href="${esc(d.logoUrl)}"` : "";
  // 占位：无 logo 时首字色块
  const letter = esc(truncate(title, 1) || "M");

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

  ${logoData
    ? `<image ${logoData} x="40" y="40" width="72" height="72" preserveAspectRatio="xMidYMid meet" />`
    : `<rect x="40" y="40" width="72" height="72" rx="16" fill="#ffffff" />
       <text x="76" y="92" text-anchor="middle" font-size="44" font-weight="700" fill="#000" font-family="system-ui, sans-serif">${letter}</text>`}

  <text x="136" y="${nameY}" font-size="56" font-weight="700" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif">${esc(name)}</text>

  <text x="136" y="${nameY + 56}" font-size="28" fill="#ffffff" opacity="0.55" font-family="system-ui, sans-serif">${esc(desc)}</text>

  <line x1="136" y1="500" x2="1064" y2="500" stroke="rgba(255,255,255,0.15)" stroke-width="2" />
  <text x="136" y="560" font-size="30" font-weight="600" fill="#ffffff" letter-spacing="6" font-family="monospace">${esc(brand)}</text>
  <text x="1064" y="560" text-anchor="end" font-size="24" fill="#ffffff" opacity="0.4" font-family="monospace">算力小铺 · compute flux</text>

  ${idBadge}
</svg>`;
}
