import type { ProviderInfo } from "@/hooks/useShops";
import { HeaderNav } from "@/widgets/HeaderNav";
import { WalletActions } from "@/widgets/WalletActions";
import { LanguageSwitcher } from "@/widgets/LanguageSwitcher";
import { Button } from "@/ui/button";
import { KeyRound } from "lucide-react";
import { useApiKeysModal } from "@/features/apiKeys/ApiKeysModal";

/**
 * 店铺页顶部栏：店铺品牌（名字）
 * + 原全局 Header 的重要元素（导航 / 充值 / 钱包）。
 * 度量与全局 Header 一致：h-14 容器、h-8 控件。
 * 店主入口在左栏 IdentityCard（管理店铺）。
 */
export function ShopBar({ provider }: { provider: ProviderInfo }) {
  const { openApiKeys } = useApiKeysModal();
  return (
    <div className="sticky top-0 z-50 relative w-full border-b border-white/10 bg-black/90 backdrop-blur-md">
      {/* 环境光：左侧柔光 + 顶部高光线 */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(45%_140%_at_6%_50%,rgba(255,255,255,0.06),transparent_70%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-white/25 via-white/10 to-transparent" />
      <div className="relative mx-auto flex h-14 max-w-5xl items-center gap-2 px-6">
        {/* 店铺品牌 */}
        <div className="flex min-w-0 items-center gap-3">
          <span className="truncate text-sm font-semibold tracking-tight text-white">
            {provider.Name || "未命名店铺"}
          </span>
        </div>

        {/* 导航 + 操作（与全局 Header 共用组件） */}
        <HeaderNav />

        <div className="flex-1" />

        <LanguageSwitcher />
        {/* Actions — API Key + 充值 + 钱包（与店铺页 ShopBar 共用） */}
        <Button size="sm" variant="outline" onClick={openApiKeys} className="sm:inline-flex">
          <KeyRound className="size-3.5" />
          API Key
        </Button>
        <WalletActions />
      </div>
    </div>
  );
}
