import { createConfig, fallback, http, type Config } from 'wagmi';
import { chains } from '@/shared/config/wagmi';

/**
 * 只读 RPC 配置（不依赖登录），确保所有 readContract/getLogs 都走我们指定的链 RPC，
 * 而不是 @web3auth 的 defaultWagmiConfig（eth.merkle.io）。
 */
export const wagmiClientConfig: Config = createConfig({
  chains,
  connectors: [],
  multiInjectedProviderDiscovery: false,
  ssr: true,
  transports: Object.fromEntries(
    chains.map((c) => {
      const url = c.rpcUrls.default.http?.[0];
      if (!url) {
        throw new Error(`Missing rpcUrls.default.http[0] for chain ${c.name} (${c.id}).`);
      }
      return [c.id, fallback([http(url)])];
    }),
  ) as Record<(typeof chains)[number]['id'], ReturnType<typeof fallback>>,
});

