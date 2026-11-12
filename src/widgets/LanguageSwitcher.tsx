import { useEffect, useRef, useState } from "react";
import { Check, Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/ui/button";
import { cn } from "@/shared/lib/utils";
import { setLanguage, type SupportedLang } from "@/i18n";

/** locales 中的所有语言，label 用 nav.lang_* 键（各语言下显示原生名）。 */
const LANGS: { code: SupportedLang; labelKey: string }[] = [
  { code: "en", labelKey: "nav.lang_en" },
  { code: "zh", labelKey: "nav.lang_zh" },
  { code: "ru", labelKey: "nav.lang_ru" },
  { code: "ja", labelKey: "nav.lang_ja" },
  { code: "ko", labelKey: "nav.lang_ko" },
  { code: "de", labelKey: "nav.lang_de" },
];

/**
 * 语言切换器 — 控件统一 h-8，与全局 Header / ShopBar 一致。
 * 下拉列出全部 6 种语言，点击即切换并持久化（setLanguage）。
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current =
    LANGS.find((l) => l.code === i18n.language?.slice(0, 2))?.code ?? "en";

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn("relative shrink-0", className)}>
      <Button
        size="sm"
        variant="outline"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="h-8 gap-1.5"
      >
        <Languages className="size-3.5" />
        <span className="max-w-[3.75rem] truncate text-[13px]">
          {t(`nav.lang_${current}`)}
        </span>
      </Button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-36 overflow-hidden rounded-md border border-white/15 bg-black py-1 shadow-xl">
          {LANGS.map((l) => {
            const active = l.code === current;
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => {
                  setLanguage(l.code);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between px-3 py-1.5 text-left text-[13px] transition-colors",
                  active
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                )}
              >
                <span>{t(l.labelKey)}</span>
                {active ? <Check className="size-3.5" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
