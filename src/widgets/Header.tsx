import { Link } from "react-router-dom";
import { KeyRound } from "lucide-react";
import { Logo } from "@/ui/Logo";
import { HeaderNav } from "./HeaderNav";
import { WalletActions } from "./WalletActions";
import { Button } from "@/ui/button";
import { useApiKeysModal } from "@/features/apiKeys/ApiKeysModal";
import { LanguageSwitcher } from "@/widgets/LanguageSwitcher";

/**
 * Header 度量规范（统一对齐）：
 * - 容器 h-14（56px），所有交互控件统一 h-8（32px）
 * - 文字：导航 / 按钮 13px，钱包地址 12px mono，品牌字标 12px mono
 * - 图标：行内图标 14px（size-3.5），独立图标按钮内 16px（size-4）
 * - 间距：控件间 8px，品牌→导航分隔线 pl-5
 * - 店铺页（/shops/:id）不渲染本 Header，由 ShopDetail 的 ShopBar 接管
 */

export default function Header() {
  const { openApiKeys } = useApiKeysModal();
  return (
    <header className="sticky px-4 top-0 z-50 w-full border-b border-white/10 bg-black/90 backdrop-blur-md relative">
      {/* 环境光：左侧柔光 + 顶部高光线 */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(45%_140%_at_6%_50%,rgba(255,255,255,0.05),transparent_70%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-white/25 via-white/10 to-transparent" />
      <div className="relative mx-auto flex h-14 max-w-5xl items-center gap-2">
        {/* Brand → 我的店铺（私域首页） */}
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <span className="relative">
            <span className="absolute -inset-1 rounded-md bg-white/10 blur-md" />
            <Logo className="relative h-5 w-auto text-white" />
          </span>
          <span className="hidden font-mono text-xs font-medium tracking-[0.3em] text-white sm:inline">
            COMPUTEFLUX SHOP
          </span>
        </Link>

        <HeaderNav />

        <div className="flex-1" />

        {/* Actions — API Key + 充值 + 钱包（与店铺页 ShopBar 共用） */}
        <Button size="sm" variant="outline" onClick={openApiKeys} className="sm:inline-flex">
          <KeyRound className="size-3.5" />
          API Key
        </Button>
        <LanguageSwitcher />
        <WalletActions />
      </div>
    </header>
  );
}
