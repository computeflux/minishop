import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Web3AuthProvider } from "@wetee/web3auth/react";
import type { Locale as Web3AuthLocale } from "@wetee/web3auth/react";
import { WagmiProvider } from "wagmi";
import { createWeb3AuthContextConfig } from "@/shared/config/web3authContext";
import { wagmiClientConfig } from "@/shared/config/wagmiClient";
import { getAuthBackendUrl } from "@/shared/config/api";
import { Toaster } from "@/ui/sonner";

const queryClient = new QueryClient();

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const githubClientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
const twitterClientId = import.meta.env.VITE_TWITTER_CLIENT_ID;
// OAuth 回调地址可用 VITE_*_REDIRECT_URI 显式覆盖（需与 GitHub/X 后台登记的 callback URL 完全一致）；
// 默认取 origin 根路径 /oauth/callback.html（不带 VITE_BASE 前缀——回调页由 SSR runner/静态托管在根路径提供）
const googleRedirectUri = import.meta.env.VITE_GOOGLE_REDIRECT_URI;
const githubRedirectUri = import.meta.env.VITE_GITHUB_REDIRECT_URI;
const twitterRedirectUri = import.meta.env.VITE_TWITTER_REDIRECT_URI;

export function AppProviders({
  children,
  client,
}: {
  children: React.ReactNode;
  client?: QueryClient;
}) {
  // 客户端用单例；SSR 每请求传入独立 client（避免并发串数据）。
  const qc = client ?? queryClient;
  const authBackendUrl = getAuthBackendUrl();
  // SSR 无 window：登录只发生在浏览器端，此时留空
  const oauthRedirectUri =
    typeof window === "undefined"
      ? undefined
      : `${window.location.origin}/oauth/callback.html`;

  return (
    <Web3AuthProvider
      config={createWeb3AuthContextConfig({
        googleClientId: googleClientId || undefined,
        googleRedirectUri: googleRedirectUri || oauthRedirectUri,
        githubClientId: githubClientId || undefined,
        githubRedirectUri: githubRedirectUri || oauthRedirectUri,
        twitterClientId: twitterClientId || undefined,
        twitterRedirectUri: twitterRedirectUri || oauthRedirectUri,
        authBackendUrl: authBackendUrl || undefined,
        explorerUrl: "https://blockscout-testnet.polkadot.io",
        theme: "dark",
      })}
      locale={
        // 服务端无 localStorage：用默认语言
        typeof window === "undefined"
          ? (process.env.DEFAULT_LOCALE as Web3AuthLocale | undefined)
          : ((localStorage.getItem("minishop_lang") as Web3AuthLocale) || undefined)
      }
    >
      <QueryClientProvider client={qc}>
        <WagmiProvider config={wagmiClientConfig}>
          {children}
          <Toaster />
        </WagmiProvider>
      </QueryClientProvider>
    </Web3AuthProvider>
  );
}
