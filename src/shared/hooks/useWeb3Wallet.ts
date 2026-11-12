import { useWeb3Auth } from "@wetee/web3auth/react";
import type { WalletWrap } from "@/contracts/tee/base";

/** Get the gateway wallet (EIP-1193 provider + EVM address) for contract calls */
export function useWeb3Wallet(): WalletWrap | null {
    const { provider, address } = useWeb3Auth();
    if (!provider || !address) return null;
    return { provider, address };
}
