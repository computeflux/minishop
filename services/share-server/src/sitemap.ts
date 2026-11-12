import type { ProviderWithID } from "./chain";

export function buildSitemapXml(base: string, providers: ProviderWithID[]): string {
  const urls = providers
    .filter((p) => p.Data?.IsActive)
    .map(
      (p) => `<url><loc>${base}/share/${p.ID}.html</loc><changefreq>weekly</changefreq><priority>0.6</priority></url>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${base}</loc><changefreq>daily</changefreq><priority>0.8</priority></url>
  ${urls}
</urlset>`;
}

export const ROBOTS = `User-agent: *
Allow: /
Sitemap: {sitemap}`;

export function buildRobots(sitemapUrl: string): string {
  return ROBOTS.replace("{sitemap}", sitemapUrl);
}
