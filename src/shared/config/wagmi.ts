import { defineChain } from "viem";
// import { sepolia } from "viem/chains";

// 定义 Polkadot Hub 测试网
export const polkadotHubTestnet = defineChain({
  id: 420420417,
  name: "Polkadot Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "PAS",
    symbol: "PAS",
  },
  rpcUrls: {
    default: {
      http: ["https://eth-rpc-testnet.polkadot.io"],
    },
    public: {
      http: ["https://eth-rpc-testnet.polkadot.io"],
    },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://blockscout-testnet.polkadot.io",
    },
  },
  testnet: true,
});

// sepolia
export const chains = [polkadotHubTestnet] as const;
