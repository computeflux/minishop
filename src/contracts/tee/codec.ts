import type { Abi } from "@polkadot/api-contract";
import type { Codec } from "@polkadot/types/types";
import {
  Vec,
  Struct,
  Enum,
  Option,
  Tuple,
  Compact,
  U8aFixed,
  u8,
  u16,
  u32,
  u64,
  U128,
  U256,
  i8,
  i16,
  i32,
  i64,
  I128,
  I256,
  Bool,
  Text,
  Bytes,
  Null,
} from "@polkadot/types-codec";

// ═══════════════════════════════════════════════════════════════
// 类型守卫（返回 boolean，避免 TypeScript 联合窄化导致 never）
// ═══════════════════════════════════════════════════════════════

function guardIsVec(codec: unknown): boolean {
  return codec instanceof Vec;
}

function guardIsStruct(codec: unknown): boolean {
  return codec instanceof Struct;
}

function guardIsEnum(codec: unknown): boolean {
  return codec instanceof Enum;
}

function guardIsOption(codec: unknown): boolean {
  return codec instanceof Option;
}

function guardIsTuple(codec: unknown): boolean {
  return codec instanceof Tuple;
}

function guardIsPrimitiveNumber(codec: unknown): boolean {
  return (
    codec instanceof u8 ||
    codec instanceof u16 ||
    codec instanceof u32 ||
    codec instanceof i8 ||
    codec instanceof i16 ||
    codec instanceof i32
  );
}

function guardIsPrimitive64(codec: unknown): boolean {
  return codec instanceof u64 || codec instanceof i64;
}

function guardIsPrimitiveBigInt(codec: unknown): boolean {
  return (
    codec instanceof U128 ||
    codec instanceof U256 ||
    codec instanceof I128 ||
    codec instanceof I256
  );
}

function guardIsBool(codec: unknown): boolean {
  return codec instanceof Bool;
}

function guardIsText(codec: unknown): boolean {
  return codec instanceof Text;
}

function guardIsBytes(codec: unknown): boolean {
  return codec instanceof Bytes;
}

function guardIsCompact(codec: unknown): boolean {
  return codec instanceof Compact;
}

function guardIsHash(codec: unknown): boolean {
  // 所有固定长度字节数组（AccountId / H256 / [u8;N] 等）统一走 hex
  return codec instanceof U8aFixed;
}

function guardIsNull(codec: unknown): boolean {
  return codec instanceof Null;
}

// Vec<u8> 判定：Vec 且元素均为 u8（ink! 字符串 / Vec<u8>）
function guardIsU8aString(codec: unknown): boolean {
  if (!guardIsVec(codec)) return false;
  try {
    const vec = codec as Vec<Codec>;
    if (vec.length === 0) return false;
    return vec[0] instanceof u8;
  } catch {
    return false;
  }
}

// ── 辅助函数 ─────────────────────────────────────────────────

/** camelCase 字段名 → ABI PascalCase 的精确映射表 */
const CAMEL_TO_PASCAL: Record<string, string> = {
  // Gateway ModelInfo 字段
  uri: "URI",
  uris: "URIS",
  apiKeys: "APIKeys",
  // 通用缩写
  id: "ID",
  url: "URL",
  uri_: "URI_",
  _uri: "_URI",
};

function toPascalCase(camelKey: string): string {
  if (CAMEL_TO_PASCAL[camelKey]) return CAMEL_TO_PASCAL[camelKey];
  // 默认：首字母大写
  return camelKey.charAt(0).toUpperCase() + camelKey.slice(1);
}

function hasToString(val: unknown): val is { toString(): string } {
  return (
    val !== null &&
    typeof val === "object" &&
    typeof (val as Record<string, unknown>).toString === "function"
  );
}

function hasToJSON(val: unknown): val is { toJSON(): unknown } {
  return (
    val !== null &&
    typeof val === "object" &&
    typeof (val as Record<string, unknown>).toJSON === "function"
  );
}

// ═══════════════════════════════════════════════════════════════
// 核心递归解码器
// ═══════════════════════════════════════════════════════════════

/**
 * 将 @polkadot/types-codec 实例递归解码为 plain JavaScript 对象。
 *
 * 覆盖 ink! ABI 全部类型：
 *   - primitive (u8~u256, i8~i256, bool) → number / string / boolean
 *   - Vec<u8>  → UTF-8 字符串
 *   - Vec<T>   → T[]
 *   - array    → Vec<T>（polkadot 映射）→ T[]
 *   - composite (struct) → 递归对象
 *   - tuple    → 数组
 *   - variant  (Result/Option/enum)
 *       Result → 自动解包 Ok（Err 抛异常）
 *       Option → T | null
 *       普通 enum → { VariantName: payload }
 *   - Compact<T> → 字符串（防精度丢失）
 *   - H160/H256/H512 → hex 字符串
 *   - Text/Bytes → string
 */
export function toPlain(codec: unknown): unknown {
  if (codec == null) return null;

  // Option<T>
  if (guardIsOption(codec)) {
    const opt = codec as Option<Codec>;
    return opt.isSome ? toPlain(opt.unwrap()) : null;
  }

  // Result<T, E> —— 自动解包 Ok，Err 抛异常
  if (guardIsEnum(codec)) {
    const en = codec as Enum & {
      isOk?: boolean;
      isErr?: boolean;
      asOk?: Codec;
      asErr?: Codec;
    };
    if (en.isOk !== undefined && en.isErr !== undefined) {
      if (en.isErr) {
        throw new Error(`Contract reverted: ${stringifyErr(en.asErr)}`);
      }
      return toPlain(en.asOk);
    }
    // 普通 Enum（非 Result）—— 返回 { VariantName: payload }
    const payload = en.value;
    return { [en.type]: payload == null ? null : toPlain(payload) };
  }

  // Vec<u8> → UTF-8 string（ink! 字符串约定）
  if (guardIsU8aString(codec)) {
    const vec = codec as Vec<Codec>;
    const bytes = new Uint8Array(vec.length);
    vec.forEach((item, i) => {
      bytes[i] = (item as unknown as u8).toNumber();
    });
    return new TextDecoder().decode(bytes);
  }

  // Vec<T> → T[]
  if (guardIsVec(codec)) {
    const vec = codec as Vec<Codec>;
    const out: unknown[] = [];
    vec.forEach((item: Codec) => out.push(toPlain(item)));
    return out;
  }

  // Tuple → 数组
  if (guardIsTuple(codec)) {
    const tuple = codec as Tuple;
    const out: unknown[] = [];
    tuple.forEach((item: Codec) => out.push(toPlain(item)));
    return out;
  }

  // Struct → 对象
  // @polkadot/api-contract 将 ABI PascalCase 字段名（如 URI、APIKeys）转为 camelCase。
  // 这里从 toJSON() 取 camelCase key，再通过映射表 + 首字母大写可靠地还原 PascalCase
  if (guardIsStruct(codec)) {
    const obj: Record<string, unknown> = {};
    const s = codec as unknown as { get(key: string): Codec | undefined };
    const jsonKeys = Object.keys(
      (codec as unknown as { toJSON(): object }).toJSON()
    );
    for (const key of jsonKeys) {
      const val = s.get(key);
      if (val !== undefined) {
        // 还原 ABI 原始 PascalCase 字段名
        const pascalKey = toPascalCase(key);
        // UniAddr.v 等二进制地址字段 → 先尝试 UTF-8，含乱码则转 hex
        if (guardIsU8aString(val) || guardIsBytes(val)) {
          const raw = (
            val as unknown as { toU8a(isBare?: boolean): Uint8Array }
          ).toU8a(true);
          let decoded: string | null = null;
          try {
            decoded = new TextDecoder("utf-8", { fatal: true }).decode(raw);
          } catch {
            // fatal=true 会在无效序列时抛异常
          }
          if (decoded == null || decoded.includes("\uFFFD")) {
            obj[pascalKey] =
              "0x" +
              Array.from(raw)
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("");
          } else {
            obj[pascalKey] = decoded;
          }
        } else {
          obj[pascalKey] = toPlain(val);
        }
      }
    }
    return obj;
  }

  // 基础数字类型（小整数）
  if (guardIsPrimitiveNumber(codec)) {
    return (codec as u32).toNumber();
  }

  // u64 / i64 may exceed Number.MAX_SAFE_INTEGER → string
  if (guardIsPrimitive64(codec)) {
    return (codec as u64).toString();
  }

  // 大整数（u128 / i128 / u256 / i256）→ 字符串防精度丢失
  if (guardIsPrimitiveBigInt(codec)) {
    return (codec as U128).toString();
  }

  // Compact<T>（压缩编码整数，如 Compact<u128>）
  if (guardIsCompact(codec)) {
    return (codec as unknown as { toString(): string }).toString();
  }

  // Hash / 固定字节数组 → hex 字符串（避免 [u8;32] 默认 toString 走 UTF-8 解码乱码）
  if (guardIsHash(codec)) {
    const fixed = codec as U8aFixed;
    const raw = fixed.toU8a(true);
    return (
      "0x" +
      Array.from(raw)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
    );
  }

  // Bool
  if (guardIsBool(codec)) {
    return (codec as Bool).valueOf();
  }

  // Text → string
  if (guardIsText(codec)) {
    return (codec as Text).toString();
  }

  // Bytes → UTF-8 string（ink! 中 Vec<u8> 有时映射为 Bytes）
  if (guardIsBytes(codec)) {
    const raw = (codec as Bytes).toU8a(true);
    return new TextDecoder().decode(raw);
  }

  // Null
  if (guardIsNull(codec)) {
    return null;
  }

  // 兜底：如果有 toJSON 且无参数，优先用 toJSON()
  if (hasToJSON(codec)) {
    try {
      const json = codec.toJSON();
      if (json !== codec) return json;
    } catch {
      // ignore
    }
  }

  // 最终兜底
  if (hasToString(codec)) {
    return codec.toString();
  }
  return codec;
}

function stringifyErr(err: unknown): string {
  if (err == null) return "unknown error";
  if (hasToString(err)) return err.toString();
  if (hasToJSON(err)) return JSON.stringify(err);
  return String(err);
}

// ═══════════════════════════════════════════════════════════════
// 便捷入口
// ═══════════════════════════════════════════════════════════════

/**
 * 使用 Abi 直接解码 message 返回值（自动处理 Result + 转 plain object）
 *
 * @param abi     通过 new Abi(abiJson) 创建的实例
 * @param label   message 名称，如 "get_model"
 * @param raw     链上返回的原始 SCALE 字节
 * @returns 解码后的 plain object
 *
 * @example
 *   const model = decodeMessage<ModelInfo>(abi, 'get_model', raw);
 */
export function decodeMessage<T = unknown>(
  abi: Abi,
  label: string,
  raw: Uint8Array
): T {
  const msg = abi.findMessage(label);
  if (!msg) throw new Error(`Message "${label}" not found in ABI`);

  const codec = abi.registry.createType(msg.returnType!.toString(), raw);
  return toPlain(codec) as T;
}

/**
 * 按类型名解码（适用于已知类型 ID 或类型路径的场景）
 *
 * @param abi      Abi 实例
 * @param typeName 类型名，如 "ModelInfo" 或 "Vec<ModelInfo>"
 * @param raw      SCALE 字节
 * @returns 解码后的 plain object
 *
 * @example
 *   const model = decodeType<ModelInfo>(abi, 'ModelInfo', raw);
 */
export function decodeType<T = unknown>(
  abi: Abi,
  typeName: string,
  raw: Uint8Array
): T {
  const codec = abi.registry.createType(typeName, raw);
  return toPlain(codec) as T;
}
