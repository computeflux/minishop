import { ArrowUpRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import { DAPP_URL } from "@/shared/config/api";

export const NAV_ITEM =
  "relative flex h-full items-center gap-1.5 px-2.5 text-[13px] transition-colors hover:bg-white/[0.04]";

/**
 * 导航 — 公域市场外链（未配置 DAPP_URL 时不渲染）。
 * 店铺页的"店铺管理"入口在 ShopBar 右侧（仅店主可见）。
 */
export function HeaderNav() {
  const { t } = useTranslation();
  if (!DAPP_URL) return null;

  return (
    <nav className="hidden h-full items-stretch gap-1 border-l border-white/10 pl-4 sm:flex sm:pl-5">
      <a
        href={DAPP_URL}
        target="_blank"
        rel="noreferrer"
        className={cn(NAV_ITEM, "text-white/45 hover:text-white")}
      >
        {t("nav.marketplace", "公域市场")}
        <ArrowUpRight className="size-3.5" />
      </a>
    </nav>
  );
}
