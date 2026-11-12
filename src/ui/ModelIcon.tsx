import { useState } from "react";
import { cn } from "@/shared/lib/utils";

/**
 * Model brand icon — 按模型名前缀匹配品牌，显示 lobe-icons SVG
 * （/images/models/*.svg，已处理为白色 fill）；无品牌匹配时回退字母 tile。
 * 品牌表与 dapp 的 ModelIcon 保持一致。
 */

// 相对部署 base（如 /shops/）解析 public/images/models/*
const ICON_BASE = `${import.meta.env.BASE_URL}images/models`;

interface BrandRule {
  /** Model name prefixes to match (case-insensitive) */
  prefixes: string[];
  /** Icon filename in lobe-icons (without .svg) */
  icon: string;
  /** Brand display name */
  name: string;
}

const BRANDS: BrandRule[] = [
  // ── International ──────────────────────────────────────
  { prefixes: ["gpt", "o1", "o3", "o4", "chatgpt", "dall-e", "whisper", "tts", "codex"], icon: "openai", name: "OpenAI" },
  { prefixes: ["claude"], icon: "anthropic", name: "Anthropic" },
  { prefixes: ["gemini", "gemma", "imagen", "veo"], icon: "google", name: "Google" },
  { prefixes: ["mistral", "mixtral", "codestral", "pixtral", "magistral", "devstral", "ministral", "voxtral", "ocr"], icon: "mistral", name: "Mistral" },
  { prefixes: ["cohere", "command", "aya", "embed-v"], icon: "cohere", name: "Cohere" },
  { prefixes: ["deepseek"], icon: "deepseek", name: "DeepSeek" },
  { prefixes: ["llama"], icon: "meta", name: "Meta" },
  { prefixes: ["grok"], icon: "xai", name: "xAI" },
  { prefixes: ["compound"], icon: "groq", name: "Groq" },
  { prefixes: ["sonar"], icon: "perplexity", name: "Perplexity" },
  { prefixes: ["stable", "sdxl", "sd3"], icon: "stability", name: "Stability" },
  { prefixes: ["phi"], icon: "microsoft", name: "Microsoft" },
  // ── Chinese ────────────────────────────────────────────
  { prefixes: ["ernie"], icon: "baidu", name: "Baidu" },
  { prefixes: ["glm"], icon: "zhipu", name: "Zhipu" },
  { prefixes: ["doubao", "seedance", "seedream"], icon: "doubao", name: "Doubao" },
  { prefixes: ["kimi", "moonshot"], icon: "moonshot", name: "Moonshot" },
  { prefixes: ["yi-"], icon: "yi", name: "Yi" },
  { prefixes: ["baichuan"], icon: "baichuan", name: "Baichuan" },
  { prefixes: ["sensechat", "sensenova", "sensetime"], icon: "sensenova", name: "SenseTime" },
  { prefixes: ["minimax"], icon: "minimax", name: "MiniMax" },
  { prefixes: ["qwen", "qwq", "internlm"], icon: "qwen", name: "Qwen" },
  // ── Infra ────────────────────────────────────────────
  { prefixes: ["azure"], icon: "azure", name: "Azure" },
];

/**
 * Resolve brand info from a model name.
 * Checks both the full string and the part after "/" or ":".
 */
function resolveBrand(modelName: string): BrandRule | null {
  const lower = modelName.toLowerCase();
  const afterSep = lower.includes("/") || lower.includes(":")
    ? lower.split(/[/:]/).pop()!
    : lower;

  for (const brand of BRANDS) {
    for (const prefix of brand.prefixes) {
      if (
        lower === prefix ||
        lower.startsWith(prefix + "-") ||
        lower.startsWith(prefix + "/")
      ) {
        return brand;
      }
      if (
        afterSep === prefix ||
        afterSep.startsWith(prefix + "-") ||
        afterSep.startsWith(prefix + "_")
      ) {
        return brand;
      }
    }
  }
  return null;
}

function initialsOf(name: string): string {
  return name
    .split(/\s+|:|\/|-/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * 模型品牌图标 — 品牌 SVG 或字母 tile 回退。
 * className 控制 tile 尺寸与回退字母字号，如 `size-8 text-xs`。
 */
export function ModelIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const brand = resolveBrand(name);
  const [errored, setErrored] = useState(false);
  const showIcon = Boolean(brand) && !errored;

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center border border-white/15 bg-white/[0.1]",
        className
      )}
    >
      {showIcon && brand ? (
        <img
          src={`${ICON_BASE}/${brand.icon}.svg`}
          alt={brand.name}
          loading="lazy"
          onError={() => setErrored(true)}
          className="h-[60%] w-[60%] opacity-80"
        />
      ) : (
        <span className="font-mono leading-none text-white/60">
          {initialsOf(name) || "?"}
        </span>
      )}
    </div>
  );
}
