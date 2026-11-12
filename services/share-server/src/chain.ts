import { hexToU8a, u8aToBuffer, u8aToHex } from "@polkadot/util";
import { getAbi } from "./abi";
import { decodeReturnValue } from "./lib/decoder";

/** TEE 后端地址（读链数据走 contractDryRun 的 GraphQL 入口） */
function teeBase(): string {
  const base = process.env.TEE_API_BASE;
  if (!base) throw new Error("TEE_API_BASE is required");
  return base.replace(/\/$/, "");
}

const CALLER = "0x0000000000000000000000000000000000000000";

async function dryRun(
  contract: string,
  method: string,
  args: unknown[],
  mut: boolean,
): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Number(process.env.TEE_TIMEOUT_MS) || 15000);
  try {
    const res = await fetch(`${teeBase()}/gql`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: `query{ contractDryRun(caller:"${CALLER}", callerType: 2, contract:"${contract}", mut: ${mut}, method: "${method}", args: ${JSON.stringify(args)}) }`,
      }),
      signal: ctrl.signal,
    });
  if (!res.ok) throw new Error(`TEE gql http ${res.status}`);
  const json = (await res.json()) as {
    data?: { contractDryRun?: string };
    errors?: Array<{ message: string }>;
  };
  if (json.errors?.[0]) throw new Error(json.errors[0].message);
  return json.data?.contractDryRun ?? "";
} catch (err) {
  if (err instanceof Error && err.name === "AbortError") {
    throw new Error(`TEE gql timeout after ${process.env.TEE_TIMEOUT_MS || 15000}ms`);
  }
  throw err;
} finally {
  clearTimeout(timer);
}
}

/** ink! 类型别名降维（"store.UniAddr" -> "UniAddr"） */
function aliasType(t: string | undefined): string {
  if (!t) return "u32";
  return t.includes(".") ? t.split(".").pop()! : t;
}

function encodeArgs(msg: { args: Array<{ type: { lookupName?: string; type?: string } }> }, input: unknown[]): string[] {
  const registry = getAbi().registry;
  return msg.args.map(({ type }, i) => {
    let bytes = registry.createType(aliasType(type.lookupName || type.type), input[i]).toU8a();
    if (type.type === "Address") bytes = bytes.slice(1); // AccountId 去前缀
    return u8aToHex(bytes);
  });
}

/** 执行一次 dry-run 并解码为 plain object */
async function call<T = unknown>(label: string, input: unknown[], mut = false): Promise<T> {
  const abi = getAbi();
  const msg = abi.findMessage(label);
  if (!msg) throw new Error(`message "${label}" not found in ABI`);
  const raw = await dryRun("gateway", msg.selector.toHex(), encodeArgs(msg, input), msg.isMutating ?? mut);
  return decodeReturnValue(msg.returnType, u8aToBuffer(hexToU8a(raw)), abi.registry) as T;
}

// ── TTL + 单飞缓存 ────────────────────────────────────────────────
const valueTTL = new Map<string, [unknown, number]>();
const inflight = new Map<string, Promise<unknown>>();

/**
 * 带 TTL 的缓存 + 单飞（cache-miss 风暴时只发一个请求）。
 * 注：服务内可用 Date.now（非 workflow 脚本）。
 */
export function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const hit = valueTTL.get(key);
  if (hit && hit[1] > Date.now()) return Promise.resolve(hit[0] as T);
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const p = loader()
    .then((value) => {
      valueTTL.set(key, [value, Date.now() + ttlMs]);
      inflight.delete(key);
      return value;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });
  inflight.set(key, p);
  return p;
}

// ── 类型 ──────────────────────────────────────────────────────────
export interface UniAddr { T: number; V: string }
export interface ProviderInfo {
  Owner: UniAddr;
  Name: string;
  LogoURL: string;
  Description: string;
  ModelIds: string[];
  Region: number;
  Deposit: string;
  FeeRate: number;
  Priority: number;
  TotalRequests: string;
  SuccessRate: number;
  AvgLatency: number;
  UptimeSLA: number;
  IsActive: boolean;
  CreatedAt: string;
}
export interface ProviderWithID { ID: string; Data: ProviderInfo }
export interface ModelInfo {
  ID: string;
  Name: string;
  ProviderID: string;
  InputModalities: number;
  ContextLength: string;
  InPrice: string;
  CachedPrice: string;
  OutPrice: string;
  Thinking: boolean;
  Meta: string;
  ModelType: number;
  RouteID: string;
  URIS: string;
  APIKeys: string[];
  MaxConcurrency: number;
  Balance: string;
  IsActive: boolean;
  CreatedAt: string;
}
export interface ModelWithID { ID: string; Data: ModelInfo }

// ── 读接口 ────────────────────────────────────────────────────────
export async function getProvider(id: number): Promise<ProviderInfo> {
  return cached(`provider:${id}`, 5 * 60 * 1000, () => call<ProviderInfo>("get_provider", [id]));
}

export async function getProviderCount(): Promise<number> {
  const raw = await cached("provider:count", 5 * 60 * 1000, () => call<number>("get_provider_count", []));
  return Number(raw);
}

export async function listActiveProviders(limit = 1000): Promise<ProviderWithID[]> {
  return cached(
    "provider:list",
    5 * 60 * 1000,
    () => call<ProviderWithID[]>("list_active_providers", [0, limit]),
  );
}

export async function listProviderModels(providerID: number): Promise<ModelWithID[]> {
  return cached(
    `models:${providerID}`,
    5 * 60 * 1000,
    () => call<ModelWithID[]>("list_provider_models", [providerID]),
  );
}

export async function getModel(modelID: number): Promise<ModelInfo> {
  return cached(`model:${modelID}`, 5 * 60 * 1000, () => call<ModelInfo>("getModel", [modelID]));
}
