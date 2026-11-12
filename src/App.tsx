import {
  HashRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { Component, Suspense, lazy, useEffect, useRef, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import Header from "@/widgets/Header";
import { RechargeStatusBanner } from "@/widgets/RechargeStatusBanner";
import { useRechargeStore } from "@/shared/stores/recharge";
import { useWeb3Auth } from "@wetee/web3auth/react";
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

const Home = lazy(() => import("./pages/Home"));
const ShopDetail = lazy(() => import("./pages/ShopDetail"));
const ModelDetail = lazy(() => import("./pages/ModelDetail"));
const OpenShop = lazy(() => import("./pages/OpenShop"));

function PageLoader() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="size-4 animate-spin text-white/50" />
    </div>
  );
}

/**
 * 页面 chunk 加载失败（弱网传输截断等）时兜底：
 * 无 ErrorBoundary 时 React 会保留 SSR 静态 DOM 且不再接管 → 页面可见但所有按钮失效。
 * 捕获后展示重试 UI，重置 state 会重新触发 lazy import。
 */
class PageErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="flex h-64 flex-col items-center justify-center gap-3">
          <p className="text-sm text-white/50">页面加载失败，请检查网络后重试</p>
          <button
            onClick={() => this.setState({ failed: false })}
            className="rounded-md border border-white/20 px-4 py-1.5 text-sm text-white/80 transition-colors hover:bg-white/10"
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Global recharge modal + footer live outside the routed pages. */
function Chrome() {
  const { open, setOpen } = useRechargeModal();
  const { open: apiOpen, setOpen: setApiOpen } = useApiKeysModal();
  const { open: balOpen, setOpen: setBalOpen } = useUserBalanceModal();
  // 充值状态横幅挂在全局 Chrome（与 RechargeModal 同级）：
  // 店铺页（/:id）不渲染 Header 而由 ShopBar 接管，横幅放这里才能覆盖所有路由。
  const { isConnected } = useWeb3Auth();
  const rechargeStatus = useRechargeStore((s) => s.status);
  const rechargeError = useRechargeStore((s) => s.error);
  const dismissRecharge = useRechargeStore((s) => s.dismiss);

  // 断开钱包即清理充值状态（终止轮询定时器/代际），全局生效（含店铺页）。
  // 仅在「已连接 → 断开」的真实切换时清理，跳过首次挂载（web3auth 恢复会话期间 isConnected 尚为 false）
  const prevConnected = useRef<boolean | null>(null);
  useEffect(() => {
    if (prevConnected.current === true && !isConnected) {
      dismissRecharge();
    }
    prevConnected.current = isConnected;
  }, [isConnected, dismissRecharge]);

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
      {/*<footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 sm:flex-row sm:px-6">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/30">
            ComputeFlux · 链上算力市场
          </span>
          <div className="flex items-center gap-4">
            <span className="text-[11px] text-white/30">
              单店私域 · 按需消费 · 结算上链
            </span>
            {DAPP_URL ? (
              <a
                href={DAPP_URL}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-white/30 underline-offset-4 transition-colors hover:text-white/70 hover:underline"
              >
                公域市场 →
              </a>
            ) : null}
          </div>
        </div>
      </footer>*/}
    </>
  );
}

function AppInner() {
  const { pathname } = useLocation();
  // 店铺页（私域橱窗）不渲染平台 Header，由页面内 ShopBar 接管
  // Hash 路由：pathname 是 # 内的路径，店铺页形如 "/123"
  const isShopPage = /^\/\d+/.test(pathname);

  return (
    <div className="flex min-h-screen flex-col">
{isShopPage ? null : <Header />}
      <main className="flex-1">
        <Suspense fallback={<PageLoader />}>
          <PageErrorBoundary>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/:id" element={<ShopDetail />} />
              <Route path="models/:id" element={<ModelDetail />} />
              <Route path="open" element={<OpenShop />} />
            </Routes>
          </PageErrorBoundary>
        </Suspense>
      </main>
      <Chrome />
    </div>
  );
}

export default function App() {
  // 路由器由入口外部提供：SSR 用 StaticRouter（src/ssr/server.tsx），客户端用 BrowserRouter（src/main.tsx）。
  // AppInner 本身 router-agnostic（仅 useLocation），因此同一棵组件树可 SSR 可客户端。
  return (
    <ModalStackProvider>
      <RechargeProvider>
        <UserBalanceProvider>
          <ApiKeysProvider>
            <ChatProvider>
              <AppInner />
            </ChatProvider>
          </ApiKeysProvider>
        </UserBalanceProvider>
      </RechargeProvider>
    </ModalStackProvider>
  );
}
