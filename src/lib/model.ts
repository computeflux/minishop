import type { ModelInfoV2 } from "@/contracts/tee/types/gateway";
import i18n from "@/i18n";

/** API format keys used in URIS: 1=openai-chat, 2=anthropic, 3=google, 4=other */
export const API_FORMAT_LABEL: Record<number, string> = {
  1: "OpenAI Chat",
  2: "Anthropic",
  3: "Google",
  4: "Other",
};

/** 自定义模型 meta（全部可选，以 JSON 字符串存于链上 meta 字段）。 */
export interface ModelMeta {
  /** 输入原价 $/M（划线价，对应 inPrice） */
  listInPrice?: number;
  /** 缓存原价 $/M（划线价，对应 cachedPrice） */
  listCachedPrice?: number;
  /** 输出原价 $/M（划线价，对应 outPrice） */
  listOutPrice?: number;
  /** 模型介绍 */
  description?: string;
  /** 排序权重（越大越靠前） */
  sortWeight?: number;
  /** 调用者白名单（链上地址列表，非空时仅允许列表中的地址调用） */
  callers?: string[];
}

/** Parse a model's meta JSON (tolerates invalid format, returns empty object on failure). */
export function parseModelMeta(meta?: string): ModelMeta {
  if (!meta) return {};
  try {
    const parsed: unknown = JSON.parse(meta);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: ModelMeta = {};
    const o = parsed as Record<string, unknown>;
    if (typeof o.listInPrice === "number" && Number.isFinite(o.listInPrice))
      out.listInPrice = o.listInPrice;
    if (typeof o.listCachedPrice === "number" && Number.isFinite(o.listCachedPrice))
      out.listCachedPrice = o.listCachedPrice;
    if (typeof o.listOutPrice === "number" && Number.isFinite(o.listOutPrice))
      out.listOutPrice = o.listOutPrice;
    if (typeof o.description === "string" && o.description.trim())
      out.description = o.description;
    if (typeof o.sortWeight === "number" && Number.isFinite(o.sortWeight))
      out.sortWeight = o.sortWeight;
    if (Array.isArray(o.callers)) {
      const arr = (o.callers as unknown[]).filter(
        (c): c is string => typeof c === "string" && c.trim() !== ""
      );
      if (arr.length > 0) out.callers = arr;
    }
    return out;
  } catch {
    return {};
  }
}

/** Parse the chain-encoded URIS JSON into { apiFormat: baseUrl } */
export function parseUris(is?: string): Record<number, string> {
  if (!is) return {};
  try {
    const parsed: unknown = JSON.parse(is);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<number, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim()) out[Number(k)] = v;
    }
    return out;
  } catch {
    return is.trim() ? { 1: is.trim() } : {};
  }
}

/** Modality label (reuses model.modality_* keys). */
export function modalityLabel(m: number): string {
  const cn: Record<number, string> = {
    0x01: "文本",
    0x02: "图像",
    0x04: "音频",
    0x08: "视频",
  };
  const key: Record<number, string> = {
    0x01: "minishop.model.modality_text",
    0x02: "minishop.model.modality_image",
    0x04: "minishop.model.modality_audio",
    0x08: "minishop.model.modality_video",
  };
  if (m === 0) return i18n.t("minishop.model.unknown", "未知");
  const bits = Object.keys(cn).map(Number).filter((b) => m & b);
  return bits.length
    ? bits.map((b) => i18n.t(key[b], cn[b])).join(" / ")
    : i18n.t("minishop.model.unknown", "未知");
}

/** 折扣 — 当前价（链上 points）/ 原价（$/M）× 100，如 60 表示 60%。
 * 无原价（或原价/当前价非法、当前价 ≤ 0）时返回 null，调用方不显示折扣。 */
export function discountPct(
  current: string | number | undefined | null,
  list: number | undefined,
): number | null {
  if (list == null || list <= 0) return null;
  const c = Number(current) / 1e6;
  if (!Number.isFinite(c) || c <= 0) return null;
  return (c / list) * 100;
}

/** Chain points (1e6) → display string. */
export function formatPoints(p: string | number | undefined | null): string {
  if (p == null || p === "") return "0";
  const n = Number(p) / 1e6;
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "0";
}

/** First usable endpoint URL of a model (for the quick “体验” action). */
export function firstEndpoint(m: { URIS?: string }): string | null {
  const uris = Object.values(parseUris(m.URIS));
  return uris[0] ?? null;
}

/** Compact context length, e.g. 128000 → 128K */
export function ctxLabel(len: string | number): string {
  const n = Number(len) || 0;
  if (n >= 1000) {
    const k = n / 1000;
    return `${Number.isInteger(k) ? k : k.toFixed(1)}K`;
  }
  return String(n);
}

export function modelTypeLabel(t: number): string {
  return t === 1 ? "Edge" : t === 2 ? "Commercial" : t === 3 ? "TEE" : String(t);
}

/** Region bit → label (0/1 = global default). */
export function regionLabel(r: number): string {
  const cn: Record<number, string> = {
    0: "全球",
    1: "全球",
    2: "北美",
    3: "欧洲",
    4: "亚洲",
    5: "大洋洲",
    6: "中东",
    7: "非洲",
  };
  const key: Record<number, string> = {
    0: "minishop.common.region_global",
    1: "minishop.common.region_global",
    2: "minishop.common.region_na",
    3: "minishop.common.region_eu",
    4: "minishop.common.region_asia",
    5: "minishop.common.region_oc",
    6: "minishop.common.region_me",
    7: "minishop.common.region_af",
  };
  return i18n.t(key[r] ?? "minishop.common.region_global", cn[r] ?? "全球");
}

/** Format a 0..1 or 0..100 fraction as a percentage. */
export function pct(n: number | undefined | null): string {
  if (n == null) return "—";
  const v = Number(n)/100;
  if (!Number.isFinite(v)) return "—";
  const value = v <= 1 ? v * 100 : v;
  return `${value.toFixed(1)}%`;
}

/** Compact integer with K/M/B suffix. */
export function compact(n: number | string | undefined | null): string {
  if (n == null || n === "") return "—";
  const v = Number(n);
  if (!Number.isFinite(v) || v === 0) return "0";
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(Math.round(v));
}

/** Human-friendly summary of a model for cards. */
export function modelSummary(m: ModelInfoV2): string {
  const uris = parseUris(m.URIS);
  const firstFormat = Object.keys(uris).map(Number)[0] ?? 1;
  const fmt = API_FORMAT_LABEL[firstFormat] ?? "API";
  const fmtLabel = fmt === "Other" ? i18n.t("minishop.model.other", "其他") : fmt;
  return `${modalityLabel(m.InputModalities)} · ${fmtLabel} · ctx ${Number(m.ContextLength).toLocaleString()}`;
}
