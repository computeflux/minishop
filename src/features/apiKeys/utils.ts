import { blake2bHex } from "blakejs";

/** 本地临时/展示的密钥条目（keyHash 上链，rawKey 仅创建时展示一次） */
export interface ApiKeyItem {
  keyHash: string;
  rawKey: string;
  prefix?: string;
  rateLimit: number;
  isActive: boolean;
  createdAt: number;
}

/** 生成随机密钥：api_tee_<32 字节 hex> */
export function generateAPIKey(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  const hex = Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `api_tee_${hex}`;
}

/** blake2b-32 哈希（与链上 registerAPIKey 一致性要求相同） */
export function hashAPIKey(apiKey: string): string {
  return `0x${blake2bHex(apiKey, undefined, 32)}`;
}

/** hex(0x…) → number[]，作为 Vec<u8> 传入 contract_builder */
export function hexToBytes(hex: string): number[] {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 2) {
    bytes.push(parseInt(clean.slice(i, i + 2), 16));
  }
  return bytes;
}

/** 短哈希展示：前 8 位 + … + 末 6 位 */
export function shortHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

/** 当前秒级时间戳（链上 CreatedAt 为 u64 epoch seconds） */
export function nowTs(): number {
  return Math.floor(Date.now() / 1000);
}

/** epoch seconds → 本地日期字符串 */
export function formatDate(ts: number): string {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}
