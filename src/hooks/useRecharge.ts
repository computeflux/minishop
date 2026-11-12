import { useMutation, useQuery } from "@tanstack/react-query";
import i18n from "@/i18n";
import { useWeb3Wallet } from "@/shared/hooks/useWeb3Wallet";
import { polkadotHubTestnet } from "@/shared/config/wagmi";
import {
  getErc20ListSol,
  getErc20Metadata,
  rechargeSol,
  approveErc20Max,
  rechargeErc20,
  waitForTxReceipt,
  getContractAddress,
  type Erc20TokenConfig,
} from "@/contracts/evm/tokenSol";
import type { EIP1193Provider } from "@/contracts/tee/types";

export interface RechargeToken extends Erc20TokenConfig {
  symbol?: string;
  name?: string;
}

/**
 * 可充值（已激活）的 ERC20 代币列表。
 * 仅返回链上 active=true 的代币，并附带 name/symbol 供展示。
 */
export function useRechargeTokens(provider: EIP1193Provider | undefined) {
  return useQuery({
    queryKey: ["minishop", "rechargeTokens"],
    queryFn: async () => {
      const list = await getErc20ListSol(provider!, polkadotHubTestnet.id);
      const active = list.filter((t) => t.active);
      const withMeta = await Promise.all(
        active.map(async (t): Promise<RechargeToken> => {
          try {
            const meta = await getErc20Metadata(
              provider!,
              t.address,
              polkadotHubTestnet.id
            );
            return { ...t, name: meta.name, symbol: meta.symbol };
          } catch {
            return { ...t } as RechargeToken;
          }
        })
      );
      return withMeta;
    },
    enabled: Boolean(provider),
  });
}

export function useRecharge() {
  const wallet = useWeb3Wallet();
  const chainId = polkadotHubTestnet.id;

  const mutate = useMutation({
    mutationFn: async (params: {
      mode: "native" | "erc20";
      tokenAddress?: `0x${string}`;
      amountEther: string;
    }) => {
      if (!wallet) throw new Error(i18n.t("minishop.common.connect_first", "请先连接钱包"));
      const { mode, tokenAddress, amountEther } = params;
      const value = BigInt(Math.floor(Number(amountEther) * 1e18));
      if (value <= 0n) throw new Error(i18n.t("minishop.recharge.amount_positive", "金额需大于 0"));

      // spender for ERC20 recharge is the token.sol gateway contract
      const spender = getContractAddress(chainId);
      let txHash: string;
      if (mode === "native") {
        txHash = await rechargeSol(wallet.provider, chainId, value, wallet.address);
      } else {
        if (!tokenAddress) throw new Error(i18n.t("minishop.recharge.select_token", "请选择代币"));
        const approveTx = await approveErc20Max(
          wallet.provider,
          tokenAddress,
          spender,
          wallet.address
        );
        await waitForTxReceipt(wallet.provider, approveTx);
        txHash = await rechargeErc20(wallet.provider, chainId, tokenAddress, value, wallet.address);
      }
      await waitForTxReceipt(wallet.provider, txHash);
      return txHash;
    },
  });

  return { mutate, wallet };
}

export type { Erc20TokenConfig };
