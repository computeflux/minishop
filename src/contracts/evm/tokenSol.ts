import {
  encodeFunctionData,
  decodeFunctionResult,
  decodeAbiParameters,
  parseAbi,
} from "viem";
import type { EIP1193Provider } from "@/contracts/tee/types";
import { SOLIDITY_CONTRACT_ADDRESS } from "@/shared/config/contracts";
import TokenSolAbiJson from "./token.sol.abi.json";

import type { TokenSolAbi__factory } from "@/contracts/evm/typechain/factories/TokenSolAbi__factory";

const ABI = TokenSolAbiJson as unknown as (typeof TokenSolAbi__factory)["abi"];

export function getContractAddress(chainId: number): `0x${string}` {
  const addr = SOLIDITY_CONTRACT_ADDRESS[chainId];
  if (!addr || addr === "0x0000000000000000000000000000000000000000") {
    throw new Error(`TokenSol contract not deployed on chain ${chainId}`);
  }
  return addr as `0x${string}`;
}

function extractResult(raw: unknown): `0x${string}` {
  if (typeof raw === "string") return raw as `0x${string}`;
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    // viem publicClient.call() returns { data: "0x..." }
    if (typeof obj.data === "string") return obj.data as `0x${string}`;
    // JSON-RPC raw response: { result: "0x..." }
    if (typeof obj.result === "string") return obj.result as `0x${string}`;
  }
  return "0x";
}

/**
 * 序列化 EVM 错误。MetaMask 的 revert 原因常藏在 data / cause / error 里，
 * 直接打印 Error 只会看到 "Internal JSON-RPC error"。
 */
export function describeEvmError(err: unknown): Record<string, unknown> {
  if (!(err instanceof Error)) return { raw: String(err) };
  const e = err as Error & {
    code?: unknown;
    data?: unknown;
    cause?: unknown;
    error?: unknown;
  };
  return {
    name: e.name,
    message: e.message,
    code: e.code,
    data: e.data,
    cause: e.cause,
    error: e.error,
    stack: e.stack,
  };
}

type EvmTxRequest = {
  from?: string;
  to: string;
  value?: string;
  data: string;
  gas?: string;
};

/** 交易失败后补打诊断：provider 实际链、余额、gas 估算、eth_call 模拟结果 */
async function logTxDiagnostics(
  provider: EIP1193Provider,
  label: string,
  tx: EvmTxRequest
) {
  const diag: Record<string, unknown> = {};
  const run = async (method: string, call: () => Promise<unknown>) => {
    try {
      diag[method] = await call();
    } catch (err) {
      diag[method] = { error: describeEvmError(err) };
    }
  };

  await run("eth_chainId", () => provider.request({ method: "eth_chainId" }));
  if (tx.from) {
    await run("eth_getBalance", () =>
      provider.request({
        method: "eth_getBalance",
        params: [tx.from, "latest"],
      })
    );
  }
  await run("eth_gasPrice", () =>
    provider.request({ method: "eth_gasPrice" })
  );
  await run("eth_estimateGas", () =>
    provider.request({ method: "eth_estimateGas", params: [tx] })
  );
  await run("eth_call", () =>
    provider.request({ method: "eth_call", params: [tx, "latest"] })
  );

  console.log(`[EVM] ${label} diagnostics`, diag);
}

export type Erc20TokenConfig = {
  address: `0x${string}`;
  active: boolean;
  rate: bigint;
  unit: bigint;
};

// ── Read operations ──

/** 获取当前汇率（1 native token = ? points）
 * 汇率极少变化，加 60s 缓存避免每次打开弹窗都等一次慢速 eth_call */
const rateCache = new Map<number, { ts: number; value: bigint }>();
const RATE_CACHE_TTL_MS = 60_000;

export async function getRateSol(
  provider: EIP1193Provider,
  chainId: number
): Promise<bigint> {
  const cached = rateCache.get(chainId);
  if (cached && Date.now() - cached.ts < RATE_CACHE_TTL_MS) {
    return cached.value;
  }
  const addr = getContractAddress(chainId);
  const data = encodeFunctionData({
    abi: ABI,
    functionName: "get_rate_sol",
  });
  const raw = await provider.request({
    method: "eth_call",
    params: [{ to: addr, data }, "latest"],
  });
  const value = decodeFunctionResult({
    abi: ABI,
    functionName: "get_rate_sol",
    data: extractResult(raw),
  }) as bigint;
  rateCache.set(chainId, { ts: Date.now(), value });
  return value;
}

/** 获取充值手续费率（基点，10000 = 100%）。旧版合约无该方法时按 0 处理 */
const feeRateCache = new Map<number, { ts: number; value: bigint }>();
const FEE_RATE_CACHE_TTL_MS = 60_000;

export async function getRechargeFeeRateSol(
  provider: EIP1193Provider,
  chainId: number
): Promise<bigint> {
  const cached = feeRateCache.get(chainId);
  if (cached && Date.now() - cached.ts < FEE_RATE_CACHE_TTL_MS) {
    return cached.value;
  }
  try {
    const addr = getContractAddress(chainId);
    const data = encodeFunctionData({
      abi: ABI,
      functionName: "get_recharge_fee_rate_sol",
    });
    const raw = await provider.request({
      method: "eth_call",
      params: [{ to: addr, data }, "latest"],
    });
    const value = decodeFunctionResult({
      abi: ABI,
      functionName: "get_recharge_fee_rate_sol",
      data: extractResult(raw),
    }) as bigint;
    feeRateCache.set(chainId, { ts: Date.now(), value });
    return value;
  } catch (err) {
    console.warn("[EVM] getRechargeFeeRateSol failed, assume 0", err);
    return 0n;
  }
}

/** 获取可充值的 ERC20 代币列表 */
export async function getErc20ListSol(
  provider: EIP1193Provider,
  chainId: number
): Promise<Erc20TokenConfig[]> {
  const addr = getContractAddress(chainId);
  const data = encodeFunctionData({
    abi: ABI,
    functionName: "get_erc20_list_sol",
  });
  const raw = await provider.request({
    method: "eth_call",
    params: [{ to: addr, data }, "latest"],
  });
  const result = decodeFunctionResult({
    abi: ABI,
    functionName: "get_erc20_list_sol",
    data: extractResult(raw),
  }) as unknown as Array<{ arg1: string; arg2: boolean; arg3: bigint; arg4: bigint }>;
  return result.map((item) => ({
    address: item.arg1 as `0x${string}`,
    active: item.arg2,
    rate: item.arg3,
    unit: item.arg4,
  }));
}

/** 查询单个 ERC20 代币配置 (active, rate, unit) */
export async function getErc20ConfigSol(
  provider: EIP1193Provider,
  chainId: number,
  tokenAddress: `0x${string}`
): Promise<{ active: boolean; rate: bigint; unit: bigint }> {
  const addr = getContractAddress(chainId);
  const data = encodeFunctionData({
    abi: ABI,
    functionName: "get_erc20_config_sol",
    args: [tokenAddress],
  });
  const raw = await provider.request({
    method: "eth_call",
    params: [{ to: addr, data }, "latest"],
  });
  const result = decodeFunctionResult({
    abi: ABI,
    functionName: "get_erc20_config_sol",
    data: extractResult(raw),
  }) as unknown as { arg1: boolean; arg2: bigint; arg3: bigint };
  return { active: result.arg1, rate: result.arg2, unit: result.arg3 };
}

// ERC20 metadata ABI fragment
const ERC20_META_ABI = [
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "name",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "_owner", type: "address" },
      { name: "_spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export type Erc20Metadata = {
  decimals: number;
  symbol: string;
  name: string;
};

export type Erc20TokenDetail = Erc20Metadata & {
  balance: bigint;
};

const MULTICALL3_ADDRESS =
  "0xcA11bde05977b3631167028862bE2a173976CA11" as const;

const MULTICALL3_ABI = parseAbi([
  "function aggregate3((address,bool,bytes)[] calls) view returns ((bool,bytes)[])",
]);

/** Multicall3 可用性缓存（按 chainId）——Paseo 等测试链未部署，
 * 避免每次查询都先白等一次必败的 multicall 调用 */
const multicall3SupportCache = new Map<number, boolean>();

/** 检测链上是否部署了 Multicall3（eth_getCode），结果写入缓存 */
async function detectMulticall3(
  provider: EIP1193Provider,
  chainId: number
): Promise<boolean> {
  try {
    const raw = await provider.request({
      method: "eth_getCode",
      params: [MULTICALL3_ADDRESS, "latest"],
    });
    const ok = typeof raw === "string" && raw.length > 2;
    multicall3SupportCache.set(chainId, ok);
    return ok;
  } catch {
    multicall3SupportCache.set(chainId, false);
    return false;
  }
}

/** 使用 Multicall3 aggregate3 批量 eth_call，失败不阻断 */
async function aggregate3(
  provider: EIP1193Provider,
  calls: { target: `0x${string}`; callData: `0x${string}` }[]
): Promise<{ success: boolean; returnData: `0x${string}` }[]> {
  if (calls.length === 0) return [];

  const data = encodeFunctionData({
    abi: MULTICALL3_ABI,
    functionName: "aggregate3",
    args: [calls.map((c) => [c.target, true, c.callData] as const)],
  });

  const raw = await provider.request({
    method: "eth_call",
    params: [{ to: MULTICALL3_ADDRESS, data }, "latest"],
  });

  const decoded = decodeFunctionResult({
    abi: MULTICALL3_ABI,
    functionName: "aggregate3",
    data: extractResult(raw),
  }) as Array<[boolean, `0x${string}`]>;

  return decoded.map(([success, returnData]) => ({
    success,
    returnData: returnData || "0x",
  }));
}

/** 查询 ERC20 代币元数据（name + symbol + decimals）
 * Multicall3 已知可用时聚合为 1 次调用；否则直接并行 eth_call，不浪费必败的 multicall 尝试 */
export async function getErc20Metadata(
  provider: EIP1193Provider,
  tokenAddress: `0x${string}`,
  chainId: number
): Promise<Erc20Metadata> {
  const decimalsData = encodeFunctionData({
    abi: ERC20_META_ABI,
    functionName: "decimals",
  });
  const symbolData = encodeFunctionData({
    abi: ERC20_META_ABI,
    functionName: "symbol",
  });
  const nameData = encodeFunctionData({
    abi: ERC20_META_ABI,
    functionName: "name",
  });

  // 仅在确认链上部署了 Multicall3 时才走聚合路径；未知/不可用直接并行
  if (multicall3SupportCache.get(chainId) === true) {
    try {
      const results = await aggregate3(provider, [
        { target: tokenAddress, callData: decimalsData },
        { target: tokenAddress, callData: symbolData },
        { target: tokenAddress, callData: nameData },
      ]);

      let decimals = 18;
      let symbol = "???";
      let name = "Unknown";

      try {
        if (results[0]?.success) {
          decimals = decodeFunctionResult({
            abi: ERC20_META_ABI,
            functionName: "decimals",
            data: results[0].returnData,
          }) as number;
        }
      } catch {
        /* ignore */
      }

      try {
        if (results[1]?.success) {
          symbol = decodeFunctionResult({
            abi: ERC20_META_ABI,
            functionName: "symbol",
            data: results[1].returnData,
          }) as string;
        }
      } catch {
        /* ignore */
      }

      try {
        if (results[2]?.success) {
          name = decodeFunctionResult({
            abi: ERC20_META_ABI,
            functionName: "name",
            data: results[2].returnData,
          }) as string;
        }
      } catch {
        /* ignore */
      }

      return { decimals, symbol, name };
    } catch {
      /* 聚合失败 → 回退并行 */
    }
  } else {
    // 首次：后台检测一次供后续使用（不阻塞本次查询）
    void detectMulticall3(provider, chainId);
  }

  // Fallback: parallel eth_call
  const [rawDecimals, rawSymbol, rawName] = await Promise.all([
    provider.request({
      method: "eth_call",
      params: [{ to: tokenAddress, data: decimalsData }, "latest"],
    }),
    provider.request({
      method: "eth_call",
      params: [{ to: tokenAddress, data: symbolData }, "latest"],
    }),
    provider.request({
      method: "eth_call",
      params: [{ to: tokenAddress, data: nameData }, "latest"],
    }),
  ]);
  const decimals = decodeFunctionResult({
    abi: ERC20_META_ABI,
    functionName: "decimals",
    data: extractResult(rawDecimals),
  }) as number;
  const symbol = decodeFunctionResult({
    abi: ERC20_META_ABI,
    functionName: "symbol",
    data: extractResult(rawSymbol),
  }) as string;
  const name = decodeFunctionResult({
    abi: ERC20_META_ABI,
    functionName: "name",
    data: extractResult(rawName),
  }) as string;
  return { decimals, symbol, name };
}

/** 查询 ERC20 代币余额 */
export async function getErc20Balance(
  provider: EIP1193Provider,
  tokenAddress: `0x${string}`,
  owner: `0x${string}`
): Promise<bigint> {
  const data = encodeFunctionData({
    abi: ERC20_META_ABI,
    functionName: "balanceOf",
    args: [owner],
  });
  const raw = await provider.request({
    method: "eth_call",
    params: [{ to: tokenAddress, data }, "latest"],
  });
  return decodeFunctionResult({
    abi: ERC20_META_ABI,
    functionName: "balanceOf",
    data: extractResult(raw),
  }) as bigint;
}

/** 查询 ERC20 allowance（owner 授权给 spender 的额度） */
export async function getErc20Allowance(
  provider: EIP1193Provider,
  tokenAddress: `0x${string}`,
  owner: `0x${string}`,
  spender: `0x${string}`
): Promise<bigint> {
  const data = encodeFunctionData({
    abi: ERC20_META_ABI,
    functionName: "allowance",
    args: [owner, spender],
  });
  const raw = await provider.request({
    method: "eth_call",
    params: [{ to: tokenAddress, data }, "latest"],
  });
  return decodeFunctionResult({
    abi: ERC20_META_ABI,
    functionName: "allowance",
    data: extractResult(raw),
  }) as bigint;
}

/** ERC20 无限授权额度 */
export const MAX_UINT256 = BigInt(
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
);

/** 批量查询多个 ERC20 代币的元数据 + 余额
 * Multicall3 已知可用时聚合为 1 次 eth_call；否则直接并行 eth_call */
export async function getErc20DetailsBatch(
  provider: EIP1193Provider,
  tokens: `0x${string}`[],
  owner: `0x${string}`,
  chainId: number
): Promise<Record<string, Erc20TokenDetail>> {
  if (tokens.length === 0) return {};

  // 仅在确认链上部署了 Multicall3 时才走聚合路径；未知/不可用直接并行
  if (multicall3SupportCache.get(chainId) === true) {
    try {
      const calls: { target: `0x${string}`; callData: `0x${string}` }[] = [];

      for (const token of tokens) {
        calls.push({
          target: token,
          callData: encodeFunctionData({
            abi: ERC20_META_ABI,
            functionName: "decimals",
          }),
        });
        calls.push({
          target: token,
          callData: encodeFunctionData({
            abi: ERC20_META_ABI,
            functionName: "symbol",
          }),
        });
        calls.push({
          target: token,
          callData: encodeFunctionData({
            abi: ERC20_META_ABI,
            functionName: "name",
          }),
        });
        calls.push({
          target: token,
          callData: encodeFunctionData({
            abi: ERC20_META_ABI,
            functionName: "balanceOf",
            args: [owner],
          }),
        });
      }

      const results = await aggregate3(provider, calls);
      const map: Record<string, Erc20TokenDetail> = {};

      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const base = i * 4;

        let decimals = 18;
        let symbol = "???";
        let name = "Unknown";
        let balance = 0n;

        try {
          if (results[base]?.success) {
            decimals = decodeFunctionResult({
              abi: ERC20_META_ABI,
              functionName: "decimals",
              data: results[base].returnData,
            }) as number;
          }
        } catch {
          /* ignore */
        }

        try {
          if (results[base + 1]?.success) {
            symbol = decodeFunctionResult({
              abi: ERC20_META_ABI,
              functionName: "symbol",
              data: results[base + 1].returnData,
            }) as string;
          }
        } catch {
          /* ignore */
        }

        try {
          if (results[base + 2]?.success) {
            name = decodeFunctionResult({
              abi: ERC20_META_ABI,
              functionName: "name",
              data: results[base + 2].returnData,
            }) as string;
          }
        } catch {
          /* ignore */
        }

        try {
          if (results[base + 3]?.success) {
            balance = decodeFunctionResult({
              abi: ERC20_META_ABI,
              functionName: "balanceOf",
              data: results[base + 3].returnData,
            }) as bigint;
          }
        } catch {
          /* ignore */
        }

        map[token.toLowerCase()] = { name, symbol, decimals, balance };
      }

      return map;
    } catch {
      /* 聚合失败 → 回退并行 */
    }
  } else {
    // 首次：后台检测一次供后续使用（不阻塞本次查询）
    void detectMulticall3(provider, chainId);
  }

  // Fallback: parallel eth_call per token
  const entries = await Promise.all(
    tokens.map(async (token) => {
      try {
        const [meta, balance] = await Promise.all([
          getErc20Metadata(provider, token, chainId),
          getErc20Balance(provider, token, owner),
        ]);
        return {
          token,
          data: { ...meta, balance } as Erc20TokenDetail,
        };
      } catch {
        return {
          token,
          data: {
            name: "Unknown",
            symbol: "???",
            decimals: 18,
            balance: 0n,
          } as Erc20TokenDetail,
        };
      }
    })
  );
  const map: Record<string, Erc20TokenDetail> = {};
  for (const e of entries) {
    map[e.token.toLowerCase()] = e.data;
  }
  return map;
}

/** 批量实时查询 ERC20 余额
 * Multicall3 已知可用时聚合为 1 次 eth_call；否则直接并行 eth_call（不浪费必败的 multicall 尝试） */
export async function getErc20BalancesBatch(
  provider: EIP1193Provider,
  tokens: `0x${string}`[],
  owner: `0x${string}`,
  chainId: number
): Promise<Record<string, bigint>> {
  if (tokens.length === 0) return {};

  const balances: Record<string, bigint> = {};

  // 仅在确认链上部署了 Multicall3 时才走聚合路径；未知/不可用直接并行
  if (multicall3SupportCache.get(chainId) === true) {
    try {
      const calls = tokens.map((token) => ({
        target: token,
        callData: encodeFunctionData({
          abi: ERC20_META_ABI,
          functionName: "balanceOf",
          args: [owner],
        }),
      }));
      const results = await aggregate3(provider, calls);
      results.forEach((r, i) => {
        if (r.success) {
          try {
            balances[tokens[i].toLowerCase()] = decodeFunctionResult({
              abi: ERC20_META_ABI,
              functionName: "balanceOf",
              data: r.returnData,
            }) as bigint;
          } catch {
            /* ignore */
          }
        }
      });
      return balances;
    } catch {
      /* 聚合失败 → 回退并行 */
    }
  } else {
    // 首次：后台检测一次供后续使用（不阻塞本次查询）
    void detectMulticall3(provider, chainId);
  }

  // 并行 eth_call 实时查询（主路径），单个失败不影响其他代币
  const settled = await Promise.allSettled(
    tokens.map(async (token) => {
      const balance = await getErc20Balance(provider, token, owner);
      return [token.toLowerCase(), balance] as const;
    })
  );
  for (const s of settled) {
    if (s.status === "fulfilled") {
      balances[s.value[0]] = s.value[1];
    }
  }

  return balances;
}

/** 计算 dot_amount 能兑换多少积分 */
export async function toPointsSol(
  provider: EIP1193Provider,
  chainId: number,
  dotAmount: bigint
): Promise<bigint> {
  const addr = getContractAddress(chainId);
  const data = encodeFunctionData({
    abi: ABI,
    functionName: "to_points_sol",
    args: [dotAmount],
  });
  const raw = await provider.request({
    method: "eth_call",
    params: [{ to: addr, data }, "latest"],
  });
  return decodeFunctionResult({
    abi: ABI,
    functionName: "to_points_sol",
    data: extractResult(raw),
  }) as bigint;
}

// ── Write operations ──

/** 充值原生货币换取积分 */
export async function rechargeSol(
  provider: EIP1193Provider,
  chainId: number,
  value: bigint,
  from: string
): Promise<string> {
  const addr = getContractAddress(chainId);
  const data = encodeFunctionData({
    abi: ABI,
    functionName: "recharge_sol",
  });
  const tx = { from, to: addr, value: "0x" + value.toString(16), data };
  console.log("[EVM] recharge_sol sendTransaction", { chainId, tx });
  try {
    const txHash = await provider.request({
      method: "eth_sendTransaction",
      params: [tx],
    });
    console.log("[EVM] recharge_sol submitted", { chainId, txHash });
    return txHash as string;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[EVM] recharge_sol failed", {
      chainId,
      tx,
      error: describeEvmError(err),
    });
    const cancelled = /user rejected|user denied|user closed/i.test(msg);
    if (!cancelled) {
      await logTxDiagnostics(provider, "recharge_sol", tx);
    }
    if (msg.includes("unauthorized") || msg.includes("Password verification")) {
      throw new Error("登录会话已过期，请断开钱包后重新登录");
    }
    if (
      msg.toLowerCase().includes("user rejected") ||
      msg.toLowerCase().includes("user denied") ||
      msg.toLowerCase().includes("user closed")
    ) {
      throw new Error("已取消充值");
    }
    throw err;
  }
}

export type PendingWithdrawal = {
  user: `0x${string}`;
  token: `0x${string}`;
  amount: bigint;
  status: number;
};

/** 查询指定 nonce 的 pending withdrawal */
export async function getPendingWithdrawalSol(
  provider: EIP1193Provider,
  chainId: number,
  nonce: bigint
): Promise<PendingWithdrawal | null> {
  try {
    const addr = getContractAddress(chainId);
    const data = encodeFunctionData({
      abi: ABI,
      functionName: "get_pending_withdrawal_sol",
      args: [nonce],
    });
    const raw = await provider.request({
      method: "eth_call",
      params: [{ to: addr, data }, "latest"],
    });
    const extracted = extractResult(raw);
    const r = decodeFunctionResult({
      abi: ABI,
      functionName: "get_pending_withdrawal_sol",
      data: extracted,
    }) as PendingWithdrawal;
    // 若返回全零视为空记录（链上已 done 或 cancelled）
    const isEmpty =
      r.user === "0x0000000000000000000000000000000000000000" &&
      r.token === "0x0000000000000000000000000000000000000000" &&
      r.amount === 0n;
    console.log("[EVM] getPendingWithdrawalSol", {
      request: { chainId, nonce: nonce.toString() },
      data: {
        user: r.user,
        token: r.token,
        amount: r.amount.toString(),
        status: r.status,
      },
      isEmpty,
    });
    if (isEmpty) {
      return null;
    }
    return r;
  } catch (err) {
    console.error("[EVM] getPendingWithdrawalSol error", {
      request: { chainId, nonce: nonce.toString() },
      err,
    });
    return null;
  }
}

/** 领取提现 */
export async function claimWithdrawalSol(
  provider: EIP1193Provider,
  chainId: number,
  nonce: bigint,
  from: string
): Promise<string> {
  const addr = getContractAddress(chainId);
  const data = encodeFunctionData({
    abi: ABI,
    functionName: "claim_withdrawal_sol",
    args: [nonce],
  });
  try {
    let gas: string | undefined;
    try {
      const gasHex = await provider.request({
        method: "eth_estimateGas",
        params: [{ from, to: addr, data, value: "0x0" }],
      });
      const base = BigInt(typeof gasHex === "string" ? gasHex : "0x0");
      gas = "0x" + ((base * 12n) / 10n).toString(16);
      console.log("[Withdraw] claim estimateGas", {
        nonce: nonce.toString(),
        gas,
      });
    } catch (estErr) {
      console.error("[Withdraw] claim estimateGas failed", {
        nonce: nonce.toString(),
        estErr,
      });
      throw new Error("该提现记录已无法领取，可能已被处理或不存在");
    }
    const tx = { from, to: addr, value: "0x0", data, gas };
    console.log("[Withdraw] claim sendTransaction", {
      nonce: nonce.toString(),
      tx,
    });
    const txHash = await provider.request({
      method: "eth_sendTransaction",
      params: [tx],
    });
    console.log("[Withdraw] claim success", {
      nonce: nonce.toString(),
      txHash,
    });
    return txHash as string;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const lower = msg.toLowerCase();
    if (msg.includes("unauthorized") || msg.includes("Password verification")) {
      throw new Error("登录会话已过期，请断开钱包后重新登录");
    }
    if (
      lower.includes("user rejected") ||
      lower.includes("user denied") ||
      lower.includes("user closed")
    ) {
      throw new Error("已取消领取");
    }
    if (
      lower.includes("insufficient funds") ||
      lower.includes("not enough") ||
      lower.includes("pay for network fees")
    ) {
      throw new Error("PAS 余额不足，无法支付网络手续费");
    }
    throw err;
  }
}

/** 取消提现 */
export async function cancelWithdrawalSol(
  provider: EIP1193Provider,
  chainId: number,
  nonce: bigint,
  from: string
): Promise<string> {
  const addr = getContractAddress(chainId);
  const data = encodeFunctionData({
    abi: ABI,
    functionName: "cancel_withdrawal_sol",
    args: [nonce],
  });
  try {
    let gas: string | undefined;
    try {
      const gasHex = await provider.request({
        method: "eth_estimateGas",
        params: [{ from, to: addr, data, value: "0x0" }],
      });
      const base = BigInt(typeof gasHex === "string" ? gasHex : "0x0");
      gas = "0x" + ((base * 12n) / 10n).toString(16);
      console.log("[Withdraw] cancel estimateGas", {
        nonce: nonce.toString(),
        gas,
      });
    } catch (estErr) {
      gas = "0x" + (50000).toString(16);
      console.warn("[Withdraw] cancel estimateGas failed, fallback", {
        nonce: nonce.toString(),
        estErr,
        gas,
      });
    }
    const tx = { from, to: addr, value: "0x0", data, gas };
    console.log("[Withdraw] cancel sendTransaction", {
      nonce: nonce.toString(),
      tx,
    });
    const txHash = await provider.request({
      method: "eth_sendTransaction",
      params: [tx],
    });
    console.log("[Withdraw] cancel success", {
      nonce: nonce.toString(),
      txHash,
    });
    return txHash as string;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const lower = msg.toLowerCase();
    if (msg.includes("unauthorized") || msg.includes("Password verification")) {
      throw new Error("登录会话已过期，请断开钱包后重新登录");
    }
    if (
      lower.includes("user rejected") ||
      lower.includes("user denied") ||
      lower.includes("user closed")
    ) {
      throw new Error("已取消撤销");
    }
    if (
      lower.includes("insufficient funds") ||
      lower.includes("not enough") ||
      lower.includes("pay for network fees")
    ) {
      throw new Error("PAS 余额不足，无法支付网络手续费");
    }
    throw err;
  }
}

// Standard ERC20 approve ABI fragment
const ERC20_APPROVE_ABI = [
  {
    inputs: [
      { name: "_spender", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

/** ERC20 授权 token.sol 合约代为转账 */
export async function approveErc20(
  provider: EIP1193Provider,
  tokenAddress: `0x${string}`,
  spender: `0x${string}`,
  amount: bigint,
  from: string
): Promise<string> {
  const data = encodeFunctionData({
    abi: ERC20_APPROVE_ABI,
    functionName: "approve",
    args: [spender, amount],
  });
  const tx = { from, to: tokenAddress, value: "0x0", data };
  console.log("[EVM] approve sendTransaction", {
    tokenAddress,
    spender,
    amount: amount.toString(),
    tx,
  });
  try {
    const txHash = await provider.request({
      method: "eth_sendTransaction",
      params: [tx],
    });
    console.log("[EVM] approve submitted", { tokenAddress, txHash });
    return txHash as string;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[EVM] approve failed", {
      tokenAddress,
      spender,
      amount: amount.toString(),
      tx,
      error: describeEvmError(err),
    });
    if (
      msg.toLowerCase().includes("user rejected") ||
      msg.toLowerCase().includes("user denied") ||
      msg.toLowerCase().includes("user closed")
    ) {
      throw new Error("已取消授权");
    }
    await logTxDiagnostics(provider, "approve", tx);
    throw err;
  }
}

/** ERC20 无限授权（approve MAX_UINT256，后续充值无需再次 approve） */
export async function approveErc20Max(
  provider: EIP1193Provider,
  tokenAddress: `0x${string}`,
  spender: `0x${string}`,
  from: string
): Promise<string> {
  return approveErc20(provider, tokenAddress, spender, MAX_UINT256, from);
}

/**
 * 轮询等待交易上链（默认 2 分钟超时）。
 * 交易回滚时抛出 "Approve tx reverted"，超时抛出 "Approve tx timeout"。
 */
export async function waitForTxReceipt(
  provider: EIP1193Provider,
  txHash: string,
  timeoutMs = 120_000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    try {
      const receipt = await provider.request({
        method: "eth_getTransactionReceipt",
        params: [txHash],
      });
      if (receipt && typeof receipt === "object") {
        const status = String(
          (receipt as { status?: unknown }).status ?? ""
        ).toLowerCase();
        console.log("[EVM] waitForTxReceipt receipt", { txHash, status, receipt });
        // 0x0 / reverted = 交易回滚（MetaMask 返回 0x0，web3auth 返回 viem 格式 reverted）
        if (status === "0x0" || status === "0" || status === "reverted") {
          throw new Error("Approve tx reverted");
        }
        return;
      }
    } catch (err) {
      // 交易尚未广播完成时部分节点会报错，视为未上链继续轮询
      const msg = err instanceof Error ? err.message : String(err);
      const notFound =
        msg.includes("TransactionReceiptNotFound") ||
        msg.includes("not processed in a block yet") ||
        msg.includes("not found");
      if (notFound) continue;
      throw err;
    }
  }
  console.error("[EVM] waitForTxReceipt timeout", { txHash, timeoutMs });
  throw new Error("Approve tx timeout");
}

/** 充值 ERC20 代币换取积分（需先 approve） */
export async function rechargeErc20(
  provider: EIP1193Provider,
  chainId: number,
  tokenAddress: `0x${string}`,
  amount: bigint,
  from: string
): Promise<string> {
  const addr = getContractAddress(chainId);
  const data = encodeFunctionData({
    abi: ABI,
    functionName: "recharge_erc20",
    args: [tokenAddress, amount],
  });
  const tx = { from, to: addr, value: "0x0", data };
  console.log("[EVM] recharge_erc20 sendTransaction", {
    chainId,
    tokenAddress,
    amount: amount.toString(),
    tx,
  });

  // Pre-flight: simulate to catch revert reason before opening wallet
  try {
    await provider.request({
      method: "eth_call",
      params: [tx, "latest"],
    });
    console.log("[EVM] recharge_erc20 simulation ok");
  } catch (simErr: unknown) {
    console.error("[EVM] recharge_erc20 simulation failed", {
      tx,
      error: describeEvmError(simErr),
    });
    const err = simErr as {
      data?: string;
      message?: string;
      error?: { data?: string; message?: string };
    };

    // Try to decode revert reason from eth_call error
    let reason = err?.message ?? String(simErr);
    const hexData = err?.data ?? err?.error?.data;
    if (hexData && typeof hexData === "string" && hexData.startsWith("0x")) {
      try {
        if (hexData.startsWith("0x08c379a0")) {
          const decoded = decodeAbiParameters(
            [{ type: "string" }],
            `0x${hexData.slice(10)}` as `0x${string}`
          );
          reason = decoded[0];
        } else {
          reason = hexData;
        }
      } catch {
        reason = hexData;
      }
    }
    console.error("[ERC20 Recharge] Simulation failed:", reason);
    await logTxDiagnostics(provider, "recharge_erc20:simulation", tx);
    throw new Error(reason);
  }

  try {
    const txHash = await provider.request({
      method: "eth_sendTransaction",
      params: [tx],
    });
    console.log("[EVM] recharge_erc20 submitted", { chainId, txHash });
    return txHash as string;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[EVM] recharge_erc20 failed", {
      chainId,
      tx,
      error: describeEvmError(err),
    });
    if (msg.includes("unauthorized") || msg.includes("Password verification")) {
      throw new Error("登录会话已过期，请断开钱包后重新登录");
    }
    const cancelled = /user rejected|user denied|user closed/i.test(msg);
    if (!cancelled) {
      await logTxDiagnostics(provider, "recharge_erc20", tx);
    }
    if (
      msg.toLowerCase().includes("user rejected") ||
      msg.toLowerCase().includes("user denied") ||
      msg.toLowerCase().includes("user closed")
    ) {
      throw new Error("已取消充值");
    }
    throw err;
  }
}
