import { fetchHandler } from "./src/server.ts";

const TEE = process.env.TEE_API_BASE || "https://xiaobai.asyou.me:30118";
process.env.TEE_API_BASE = TEE;
process.env.SITE_URL = "https://test.minishop.local";

async function hit(pathname: string) {
  const req = new Request(`http://localhost${pathname}`);
  const res = await fetchHandler(req);
  const ct = res.headers.get("content-type") || "";
  const body = await res.text();
  console.log(`\n### ${req.method} ${pathname} -> ${res.status} (${ct})`);
  console.log(`    cache: ${res.headers.get("cache-control")}`);
  if (ct.includes("html") || ct.includes("xml")) {
    console.log(`    body[0:220]: ${body.slice(0, 220).replace(/\s+/g, " ")}`);
    // 关键 SEO 字段抽查
    const flags = ["og:title", "og:image", "twitter:card", "application/ld+json", "canonical"];
    console.log(`    has: ${flags.filter((f) => body.includes(f)).join(", ")}`);
  } else {
    console.log(`    body[0:160]: ${body.slice(0, 160).replace(/\s+/g, " ")}`);
  }
  return { status: res.status, body, ct };
}

console.log("TEE:", TEE);
await hit("/health");
await hit("/share/1.html");
await hit("/shop/1");
await hit("/share/1.svg");
await hit("/share/999999.html"); // 不存在的店铺
await hit("/share/999999.svg");
await hit("/sitemap.xml");
await hit("/robots.txt");
