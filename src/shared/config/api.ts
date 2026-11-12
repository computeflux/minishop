/** 规范化 API 根 URL（去空白、去尾部 /） */
export function normalizeApiBase(raw: string | undefined | null): string {
  if (raw === undefined || raw === null) return "";
  const s = String(raw).trim();
  if (!s) return "";
  return s.replace(/\/$/, "");
}

/** tee-provider 后端地址 */
const TEE_PROVIDER_BASE = normalizeApiBase(
  import.meta.env.VITE_API_BASE_URL as string | undefined
);

export function getTeeProviderBase(): string {
  return TEE_PROVIDER_BASE;
}

/**
 * 优先使用链上 providerEndpoint（与 dashboard 写入一致），
 * 否则回退 tee-provider 默认地址。
 */
export function resolveBackendApiBase(
  chainEndpoint: string | undefined | null
): string {
  const fromChain = normalizeApiBase(chainEndpoint);
  if (fromChain) return fromChain;
  return getTeeProviderBase();
}

/** CometBFT / Cosmos SDK 链 RPC 地址（用于查交易、区块） */
export function getChainRpcBase(): string {
  return normalizeApiBase(
    import.meta.env.VITE_API_CHAIN_URL as string | undefined
  );
}

/** Web3Auth 后端地址（用于 JWT 验证 & 钱包派生） */
export function getAuthBackendUrl(): string {
  const fromEnv = normalizeApiBase(
    import.meta.env.VITE_AUTH_BACKEND_URL as string | undefined
  );
  if (fromEnv) return fromEnv;
  return TEE_PROVIDER_BASE;
}

/**
 * 公域 dapp 地址（全平台店铺/模型列表）。
 * minishop 只做单店铺私域，公域浏览外链到 dapp；
 * 未配置时相关入口自动隐藏。
 */
export const DAPP_URL = normalizeApiBase(
  import.meta.env.VITE_DAPP_URL as string | undefined
);

/** C2C 平台服务地址（下单、订单进度等 /c2c 接口；不含 /c2c 前缀） */
export function getC2cApiBase(): string {
  const fromEnv = normalizeApiBase(
    import.meta.env.VITE_C2C_API_URL as string | undefined
  );
  if (fromEnv) return fromEnv;
  throw new Error("VITE_C2C_API_URL is not configured");
}
