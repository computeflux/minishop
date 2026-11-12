import { Abi } from "@polkadot/api-contract";
import fs from "node:fs";
import path from "node:path";

/**
 * gateway ABI 加载。
 * - 优先 GATEWAY_ABI_PATH（Docker 默认 /app/data/gateway.json，或任意挂载路径）
 * - 否则在仓库内回退到 minishop/public/contract/gateway.json（dev 直接 bun run）
 */
function resolveAbiPath(): string {
  if (process.env.GATEWAY_ABI_PATH) {
    const p = path.resolve(process.env.GATEWAY_ABI_PATH);
    if (fs.existsSync(p)) return p;
  }
  const candidates = [
    // src/ 向上 3 层到 minishop，再进 public
    path.join(__dirname, "../../../public/contract/gateway.json"),
    "/app/data/gateway.json",
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error(
    "gateway ABI not found. set GATEWAY_ABI_PATH to gateway.json",
  );
}

let _abi: Abi | null = null;

export function getAbi(): Abi {
  if (!_abi) {
    _abi = new Abi(JSON.parse(fs.readFileSync(resolveAbiPath(), "utf8")));
  }
  return _abi;
}
