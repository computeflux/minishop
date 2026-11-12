import {
    WEB3AUTH_NETWORK,
    fromViemChain,
    type Web3AuthNoModalOptions,
    type CustomChainConfig,
} from "@wetee/web3auth";
import { type Web3AuthContextConfig } from "@wetee/web3auth/react";
import { chains as viemChains, polkadotHubTestnet } from "@/shared/config/wagmi";

export function createWeb3AuthContextConfig(params: {
    googleClientId?: string;
    googleRedirectUri?: string;
    githubClientId?: string;
    githubRedirectUri?: string;
    twitterClientId?: string;
    twitterRedirectUri?: string;
    authBackendUrl?: string;
    explorerUrl?: string;
    theme?: "light" | "dark" | undefined;
}): Web3AuthContextConfig {
    const chains: CustomChainConfig[] = viemChains.map((c) => {
            const cfg = fromViemChain(c);
            const logo =
                c.id === polkadotHubTestnet.id
                    ? `${import.meta.env.BASE_URL}images/logos/paseo_mini.svg`
                    : `${import.meta.env.BASE_URL}images/logos/eth-official.svg`;
            return { ...cfg, logo } satisfies CustomChainConfig;
        });

    const web3AuthOptions: Web3AuthNoModalOptions = {
        clientId: params.authBackendUrl ?? "self-built",
        web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
        chains,
        defaultChainId:
            chains.find((c) => c.displayName === polkadotHubTestnet.name)
                ?.chainId ?? chains[0]?.chainId,
        uiConfig: {
            mode: params.theme ?? "dark",
            appName: "ComputeFlux",
        },
        googleClientId: params.googleClientId,
        googleRedirectUri: params.googleRedirectUri,
        githubClientId: params.githubClientId,
        githubRedirectUri: params.githubRedirectUri,
        twitterClientId: params.twitterClientId,
        twitterRedirectUri: params.twitterRedirectUri,
        authBackendUrl: params.authBackendUrl,
        explorerUrl: params.explorerUrl,
    };

    return { web3AuthOptions };
}
