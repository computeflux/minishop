import { useEffect } from "react";
import { ogLocale } from "@/i18n";

export type MetaType = "website" | "article";

export interface MetaProps {
  title?: string;
  description?: string;
  imageUrl?: string; // og:image（绝对 URL 或 data:）
  url?: string; // canonical / og:url，默认当前地址
  type?: MetaType;
  imageAlt?: string;
}

/** 创建或更新一个 meta / link 标签。tag="link" 时用 href，否则用 content。 */
function setTag(
  selector: string,
  value: string | undefined,
  kind: "meta" | "link",
  attrKey: "name" | "property",
  attrVal: string,
): void {
  let el = document.querySelector(selector) as HTMLMetaElement | HTMLLinkElement | null;
  if (!el) {
    el = document.createElement(kind);
    document.head.appendChild(el);
  }
  if (value === undefined) {
    el.remove();
    return;
  }
  const contentAttr = kind === "link" ? "href" : "content";
  (el as HTMLMetaElement).setAttribute(contentAttr, value);
  (el as HTMLMetaElement).setAttribute(attrKey, attrVal);
}

function writeMeta(p: MetaProps): void {
  const { title, description, imageUrl, url, type = "website", imageAlt } = p;

  document.title = title ?? "";

  const desc = description ?? "";
  const shareUrl = url ?? window.location.href;

  setTag("meta[name=description]", desc, "meta", "name", "description");
  setTag("link[rel=canonical]", shareUrl, "link", "name", "");

  // Open Graph
  setTag("meta[property=\"og:title\"]", title, "meta", "property", "og:title");
  setTag("meta[property=\"og:description\"]", desc, "meta", "property", "og:description");
  setTag("meta[property=\"og:type\"]", type, "meta", "property", "og:type");
  setTag("meta[property=\"og:url\"]", shareUrl, "meta", "property", "og:url");
  setTag("meta[property=\"og:image\"]", imageUrl, "meta", "property", "og:image");
  setTag("meta[property=\"og:image:alt\"]", imageAlt, "meta", "property", "og:image:alt");
  setTag("meta[property=\"og:site_name\"]", "ComputeFlux Shop", "meta", "property", "og:site_name");
  setTag("meta[property=\"og:locale\"]", ogLocale(), "meta", "property", "og:locale");

  // Twitter Card
  setTag("meta[name=\"twitter:card\"]", "summary_large_image", "meta", "name", "twitter:card");
  setTag("meta[name=\"twitter:title\"]", title, "meta", "name", "twitter:title");
  setTag("meta[name=\"twitter:description\"]", desc, "meta", "name", "twitter:description");
  setTag("meta[name=\"twitter:image\"]", imageUrl, "meta", "name", "twitter:image");
}

/**
 * 动态更新页面 SEO / 社交分享 meta 标签。
 * 能让「会执行 JS」的爬虫（Telegram、X 预览等）拿到每页的标题、简介与分享图。
 */
export function useMeta(p: MetaProps): void {
  useEffect(() => {
    writeMeta(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.title, p.description, p.imageUrl, p.url, p.type, p.imageAlt]);
}
