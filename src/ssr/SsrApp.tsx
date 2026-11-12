/**
 * SSR 专用组件树。
 *
 * 与 App.tsx 结构一致，但静态导入页面（不用 lazy()）。原因：
 * lazy() 的动态导入在 SSR 会创建异步 Suspense 边界，而 react-dom 的 renderToReadableStream
 * 在这个 Bun 版本关闭异步边界时有 bug（"abortable task at the root... bug in React"），
 * 静态导入可绕过，使 SSR 渲染稳定。
 *
 * 由 src/ssr/server.tsx 在 StaticRouter + QueryClientProvider + web3auth 存根 provider 内使用。
 */
import { Routes, Route, useLocation } from "react-router-dom";
import Header from "@/widgets/Header";
import { RechargeStatusBanner } from "@/widgets/RechargeStatusBanner";
import { useRechargeStore } from "@/shared/stores/recharge";
import { RechargeProvider, useRechargeModal } from "@/app/recharge";
import RechargeModal from "@/pages/RechargeModal";
import {
  UserBalanceProvider,
  UserBalanceModal,
  useUserBalanceModal,
} from "@/features/seller/UserBalanceModal";
import { ChatProvider } from "@/features/chat/chatContext";
import { ChatWidget } from "@/features/chat/ChatWidget";
import { ApiKeysProvider, ApiKeysModal, useApiKeysModal } from "@/features/apiKeys/ApiKeysModal";
import { ModalStackProvider } from "@/ui/modalStack";
import Home from "@/pages/Home";
import ShopDetail from "@/pages/ShopDetail";
import ModelDetail from "@/pages/ModelDetail";
import OpenShop from "@/pages/OpenShop";

/** Global recharge modal 等位于页面外的全局组件（与 App.tsx 的 Chrome 一致）。 */
function SsrChrome() {
    const { open, setOpen } = useRechargeModal();
    const { open: apiOpen, setOpen: setApiOpen } = useApiKeysModal();
    const { open: balOpen, setOpen: setBalOpen } = useUserBalanceModal();
    // 充值状态横幅挂在全局（与 App.tsx 的 Chrome 一致），覆盖所有路由（含店铺页）
    const rechargeStatus = useRechargeStore((s) => s.status);
    const rechargeError = useRechargeStore((s) => s.error);
    const dismissRecharge = useRechargeStore((s) => s.dismiss);
    return (
        <>
            <RechargeModal open={open} onOpenChange={setOpen} />
            <RechargeStatusBanner
                status={rechargeStatus}
                error={rechargeError}
                onDismiss={dismissRecharge}
            />
            <UserBalanceModal open={balOpen} onOpenChange={setBalOpen} />
            <ApiKeysModal open={apiOpen} onOpenChange={setApiOpen} />
            <ChatWidget />
        </>
    );
}

export function SsrAppInner() {
    const { pathname } = useLocation();
    // 店铺页（私域橱窗）不渲染平台 Header，由页面内 ShopBar 接管
    const isShopPage = /^\/\d+/.test(pathname);

    return (
        <div className="flex min-h-screen flex-col">
            {isShopPage ? null : <Header />}
            <main className="flex-1">
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path=":id" element={<ShopDetail />} />
                    <Route path="models/:id" element={<ModelDetail />} />
                    <Route path="open" element={<OpenShop />} />
                </Routes>
            </main>
            <SsrChrome />
        </div>
    );
}

export function SsrApp() {
    return (
        <ModalStackProvider>
            <RechargeProvider>
                <UserBalanceProvider>
                    <ApiKeysProvider>
                        <ChatProvider>
                            <SsrAppInner />
                        </ChatProvider>
                    </ApiKeysProvider>
                </UserBalanceProvider>
            </RechargeProvider>
        </ModalStackProvider>
    );
}
