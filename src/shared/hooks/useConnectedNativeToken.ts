import { useMemo } from 'react';
import { useWeb3Auth } from "@wetee/web3auth/react";
import { chains } from '@/shared/config/wagmi';
import { parseChainId } from '@/shared/utils';

export type NativeCurrencyInfo = {
  name: string;
  symbol: string;
  decimals: number;
};

/** 获取当前已连接链的原生币信息（name/symbol/decimals）。 */
export function useConnectedNativeToken(): NativeCurrencyInfo | undefined {
  const { chainId: w3ChainId } = useWeb3Auth();
  // 统一走 parseChainId：兼容 0x 前缀十六进制与十进制字符串，
  // 避免 parseInt(…, 16) 把十进制串（如 "137"）误解析成 311 而查不到链
  const chainId = parseChainId(w3ChainId);

  return useMemo(() => {
    const chain = chains.find((c) => c.id === chainId);
    if (!chain) return undefined;
    return chain.nativeCurrency;
  }, [chainId]);
}

