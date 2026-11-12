/**
 * web3auth 的 SSR 存根。
 *
 * 真实 `@wetee/web3auth/react` 的 Web3AuthProvider 内部用了没有 getServerSnapshot 的
 * useSyncExternalStore，服务端渲染会崩。SSR 构建时通过 vite alias 把 /react 指向本模块：
 * - Web3AuthProvider：no-op（组件不依赖真实 context，存根 hooks 直接返回断开默认值）。
 * - 各 hook：返回「未连接钱包」默认值，服务端渲染出「连接钱包」按钮。
 *
 * 客户端构建不使用本模块（走真实 web3auth）。
 */
import type React from "react";

export type Locale = "en" | "zh" | "ru" | "ja" | "ko" | "de";

export interface Web3AuthContextConfig {
    googleClientId?: string;
    googleRedirectUri?: string;
    githubClientId?: string;
    githubRedirectUri?: string;
    twitterClientId?: string;
    twitterRedirectUri?: string;
    authBackendUrl?: string;
    explorerUrl?: string;
    theme?: "light" | "dark" | undefined;
}

export interface Web3AuthContextValue {
    address: string | null;
    isConnected: boolean;
    chain?: string;
}

export function Web3AuthProvider({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}

export function useWeb3Auth(): Web3AuthContextValue {
    return { address: null, isConnected: false, chain: "polkadot" };
}

export interface Web3AuthConnectApi {
    connect: () => void;
    loading: boolean;
}

export function useWeb3AuthConnect(): Web3AuthConnectApi {
    return { connect: () => {}, loading: false };
}

export interface Web3AuthDisconnectApi {
    disconnect: () => void;
}

export function useWeb3AuthDisconnect(): Web3AuthDisconnectApi {
    return { disconnect: () => {} };
}

/** 服务端 no-op（切换语言仅在客户端用户操作时触发）。 */
export function setLocale(_locale: Locale): void {
    /* noop */
}
