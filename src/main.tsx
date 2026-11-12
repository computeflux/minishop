import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, hydrate as hydrateQuery } from "@tanstack/react-query";
import "./index.css";
import "@/i18n";
import { AppProviders } from "@/app/providers";
import App from "@/App";

// SSR 注入的全局（server.tsx 在 HTML 中写入）。声明供 TS 使用。
declare global {
    interface Window {
        __SSR__?: boolean;
        __QUERY_STATE__?: unknown;
    }
}

// 若服务端做了 SSR 预取，把 dehydrate 状态回填到客户端 QueryClient，
// 使 useShop 等 hook 首屏即取到服务端数据（避免 flash loading）。
function makeQueryClient(): QueryClient {
    const pending = (globalThis.window as Window).__QUERY_STATE__ as unknown;
    const client = new QueryClient({
        defaultOptions: { queries: { staleTime: 60_000, retry: false, gcTime: 60_000 } },
    });
    if (pending) {
        try {
            // React Query v5 移除 client.hydrate()；用包导出的 hydrate() 回填。
            hydrateQuery(client, pending as Parameters<typeof hydrateQuery>[1]);
        } catch {
            /* 状态格式不兼容时回退到空 client，不影响客户端自取 */
        }
    }
    return client;
}

const container = document.getElementById("root");
const queryClient = makeQueryClient();
const routerElement = (
    <StrictMode>
        <AppProviders client={queryClient}>
            <App />
        </AppProviders>
    </StrictMode>
);

// 统一全量客户端渲染（不用 hydrateRoot）：
// SSR 树用 web3auth 存根 provider + 服务端默认语言渲染，客户端是真实 provider + 用户语言，
// 两者文本/结构不一致时 hydration 恢复行为不可靠（线上出现按钮无响应）。
// SSR HTML 仅服务爬虫/SEO 首抓；客户端渲染后交互完整，__QUERY_STATE__ 回填保证无数据 flash。
if (container) {
    // ⚠️ BrowserRouter 需 nginx/CDN try_files 兜底，否则深度链接刷新会 404。
    createRoot(container).render(<BrowserRouter>{routerElement}</BrowserRouter>);
}
