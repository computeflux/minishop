/** Blockscout API v2 客户端
 * 官方公开链索引器，CORS 开放（access-control-allow-origin: *），
 * 比 RPC eth_call 快得多：一次请求返回全部代币余额 + 元数据。
 * 数据近实时（滞后数秒），失败时调用方回退链上查询。
 */

const BLOCKSCOUT_BASES: Record<number, string> = {
  // Paseo Asset Hub (Polkadot Hub Testnet)
  [420420417]: "https://blockscout-testnet.polkadot.io",
};

export interface BlockscoutTokenBalance {
  token: {
    address_hash: string;
    name: string;
    symbol: string;
    decimals: string;
    type: string;
  };
  value: string;
}

/** 获取地址持有的所有代币余额（含元数据），一次请求 */
export async function fetchBlockscoutTokenBalances(
  chainId: number,
  address: string,
  timeoutMs = 4000
): Promise<BlockscoutTokenBalance[]> {
  const base = BLOCKSCOUT_BASES[chainId];
  if (!base) throw new Error(`No blockscout base for chain ${chainId}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(
      `${base}/api/v2/addresses/${address}/token-balances`,
      { signal: controller.signal }
    );
    if (!res.ok) throw new Error(`Blockscout HTTP ${res.status}`);
    const data = (await res.json()) as BlockscoutTokenBalance[];
    return Array.isArray(data) ? data : [];
  } finally {
    clearTimeout(timer);
  }
}

/** 用 Blockscout 查询指定代币余额；未持有或未索引到的代币为 0n
 * @returns address(小写) → balance
 */
export async function fetchErc20BalancesFromBlockscout(
  chainId: number,
  address: string,
  tokens: readonly `0x${string}`[]
): Promise<Record<string, bigint>> {
  const items = await fetchBlockscoutTokenBalances(chainId, address);
  const wanted = new Set(tokens.map((t) => t.toLowerCase()));
  const result: Record<string, bigint> = {};
  for (const token of tokens) result[token.toLowerCase()] = 0n;
  for (const item of items) {
    const key = item.token.address_hash.toLowerCase();
    if (item.token.type !== "ERC-20" || !wanted.has(key)) continue;
    try {
      result[key] = BigInt(item.value || "0");
    } catch {
      /* 忽略异常值 */
    }
  }
  return result;
}
