import i18n from "@/i18n";
import { encodeAddress, decodeAddress } from "@polkadot/keyring";
import { u8aToHex, hexToU8a } from "@polkadot/util";
import { toast } from "@/shared/lib/toast";

// ── Chain ──

/**
 * 统一解析 web3auth 返回的 chainId（可能是带 0x 前缀的十六进制字符串，
 * 也可能是十进制字符串）。返回十进制 number，非法值返回 undefined。
 *
 * 背景：RechargeModal 用 `parseInt(w3ChainId, 16)`、useConnectedNativeToken 用 `Number(w3ChainId)`，
 * 两者对十六进制字符串结果相同，但一旦 web3auth 返回十进制字符串（如 "137"）就会不一致
 *（137 vs 311），导致「本 hook 取到的原生币」与 `getContractAddress(chainId)` 使用的链不一致。
 * 统一走这里，两处复用。
 */
export function parseChainId(
  value: string | number | null | undefined
): number | undefined {
  if (value == null) return undefined;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  // 带 0x 前缀按十六进制解析；否则 Number() 同时兼容十进制字符串
  const parsed = trimmed.startsWith("0x") || trimmed.startsWith("0X")
    ? parseInt(trimmed, 16)
    : Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

// ── Format: numbers ──

/**
 * 链上数值归一化：后端对 u64/计数类返回值会加千分位逗号（如 "99,999"），
 * 直接 Number() 会得到 NaN。统一在此去逗号转 number，非法/空值返回 0。
 * 所有「链上数字 → number」的解析都应走这里，避免各处重复 replace 逻辑。
 */
export function parseChainNumber(
  v: string | number | null | undefined
): number {
  if (v == null) return 0;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function formatCredits(
  points: string | number | undefined | null
): string {
  if (points == null) return "0";
  const num = Number(points);
  if (!Number.isFinite(num)) return "0";
  // 除以 1000000（链上 points → 显示金额 $）
  const credits = num / 1000000;
  // >1K 忽略小数，个位数最多 2 位小数，纯小数最多 4 位小数（末尾 0 截断）
  if (credits >= 1e9) return `${(credits / 1e9).toFixed(0)}B`;
  if (credits >= 1e6) return `${(credits / 1e6).toFixed(0)}M`;
  if (credits >= 1e3) return `${(credits / 1e3).toFixed(0)}K`;
  if (credits >= 1) return parseFloat(credits.toFixed(2)).toString();
  return parseFloat(credits.toFixed(4)).toString();
}

export function formatEther(
  wei: bigint | string | number | undefined | null
): string {
  if (wei == null) return "0.0000";
  try {
    const value = BigInt(wei);
    const ether = Number(value) / 1e18;
    return ether.toFixed(4);
  } catch {
    return "0.0000";
  }
}

export function formatTokenAmount(
  amount: bigint | string | number | undefined | null,
  decimals: number
): string {
  if (amount == null || !Number.isFinite(decimals) || decimals < 0) return "0";
  try {
    const value = BigInt(amount);
    const num = Number(value) / 10 ** decimals;
    return num.toFixed(6).replace(/\.?0+$/, "").replace(/\.$/, "");
  } catch {
    return "0";
  }
}

export function parseEther(ether: string): bigint {
  const value = parseFloat(ether);
  return BigInt(Math.floor(value * 1e18));
}

export function formatQuota(
  quota: bigint | string | number | undefined | null
): string {
  if (quota == null) return "0";
  try {
    const value = BigInt(quota);
    const num = Number(value);
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toString();
  } catch {
    return "0";
  }
}

// ── Format: time ──

export function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  if (days > 0) return i18n.t("time.days", { count: days });
  const hours = Math.floor(seconds / 3600);
  if (hours > 0) return i18n.t("time.hours", { count: hours });
  const minutes = Math.floor(seconds / 3600);
  if (minutes > 0) return i18n.t("time.minutes", { count: minutes });
  return i18n.t("time.seconds", { count: seconds });
}

export function formatTimestamp(timestamp: bigint | number): string {
  const date = new Date(Number(timestamp) * 1000);
  const lang = i18n.language?.toLowerCase().startsWith("zh")
    ? "zh-CN"
    : "en-US";
  return date.toLocaleString(lang);
}

export function formatDate(timestamp: bigint | number): string {
  const date = new Date(Number(timestamp) * 1000);
  const lang = i18n.language?.toLowerCase().startsWith("zh")
    ? "zh-CN"
    : "en-US";
  return date.toLocaleDateString(lang, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ── Address ──

export function shortenAddress(address: string, chars = 4): string {
  if (!address) return "";
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * 地址相等比较（不要用 `===` 直接比地址）。
 *
 * 背景（2026-11-09）：店铺页原来是 `provider.Owner?.V === address` 逐字符比较。
 * 链上 `Owner.V` 是 EIP-55 checksummed 地址（大小写混合），而 web3auth 内嵌钱包
 *（邮箱登录）返回**全小写**地址 → 两者永不相等，导致邮箱登录看不到「管理店铺」按钮；
 * MetaMask 返回 checksummed 地址，所以碰巧正常。
 *
 * 规则：两侧都是 EVM 十六进制地址（0x + 40 hex）时大小写不敏感；
 * 其它（SS58/base58 等）保持大小写敏感——base58 的大小写是有意义的。
 */
export function sameAddress(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  if (!a || !b) return false;
  const evm = /^0x[0-9a-fA-F]{40}$/;
  if (evm.test(a) && evm.test(b)) return a.toLowerCase() === b.toLowerCase();
  return a === b;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    toast.success("已复制");
    return true;
  } catch {
    toast.error("复制失败");
    return false;
  }
}

export function shortAddress(address: string): string {
  if (!address) return "";
  return (
    address.substring(0, 4) + "..." + address.substring(address.length - 6)
  );
}

export function showUniAddr(addr: { v: string; t: number }): string {
  console.log(addr);
  return "";
}

export function ss58toHex(address: string): string {
  if (!address) return "0x" + "0".repeat(64);
  const d = decodeAddress(address);
  return u8aToHex(d);
}

export function hexToSS58(address: string): string {
  const d = hexToU8a(address);
  return encodeAddress(d, 42);
}

// ── Error handling ──

export function humanizeWeb3Error(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  const lower = msg.toLowerCase();

  if (
    lower.includes("user rejected") ||
    lower.includes("user denied") ||
    lower.includes("denied message signature") ||
    lower.includes("rejected the request") ||
    lower.includes("user closed the modal")
  ) {
    return i18n.t("errors.user_rejected", "已取消签名");
  }

  if (lower.includes("insufficient funds")) {
    return i18n.t("errors.insufficient_funds", "余额不足");
  }

  return msg || i18n.t("errors.unknown", "操作失败，请重试");
}

// ── Toast helpers ──

export function showSuccess(message: string): void {
  toast.success(message);
}

export function showError(message: string): void {
  toast.error(message, { duration: 8000 });
}

export function showWarning(message: string): void {
  toast.warning(message);
}

export function showInfo(message: string): void {
  toast.info(message);
}
