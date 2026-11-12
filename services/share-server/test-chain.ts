import { Abi } from "@polkadot/api-contract";
import { hexToU8a, u8aToBuffer, u8aToHex } from "@polkadot/util";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 复用 decoder.ts 的已验证解码器（与 minishop base.ts 同路径）
const { decodeReturnValue } = await import("../../src/contracts/tee/decoder.ts");

const TEE = process.env.TEE_API_BASE || "https://xiaobai.asyou.me:30118";

function resolveAlias(registry, name) {
  if (name && name.includes(".")) return name.split(".").pop();
  return name;
}

async function contractDryRun(contract, method, args, mut = false) {
  const res = await fetch(`${TEE}/gql`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: `query{ contractDryRun(caller:"0x0000000000000000000000000000000000000000", callerType: 2, contract:"${contract}", mut: ${mut}, method: "${method}", args: ${JSON.stringify(args)}) }`,
    }),
  });
  const json = await res.json();
  if (json.errors?.[0]) throw new Error(json.errors[0].message);
  return json.data.contractDryRun;
}

const abi = new Abi(JSON.parse(fs.readFileSync(path.join(__dirname, "../../public/contract/gateway.json"), "utf8")));

async function getProvider(id) {
  const msg = abi.findMessage("get_provider");
  const registry = abi.registry;
  const params = [id]; // get_provider(providerID: u32)
  const argstrs = msg.args.map(({ type }, index) => {
    const lookupName = type.lookupName || type.type;
    let p = registry.createType(resolveAlias(registry, lookupName), params[index]).toU8a();
    return u8aToHex(p);
  });
  const raw = await contractDryRun("gateway", msg.selector.toHex(), argstrs, msg.isMutating);
  // 与 base.ts 一致：hex -> bytes -> 用 returnType TypeDef 解码
  const bt = hexToU8a(raw);
  return decodeReturnValue(msg.returnType, u8aToBuffer(bt), abi.registry);
}

const id = Number(process.argv[2] || 1);
console.log("Fetching provider", id, "from", TEE);
const provider = await getProvider(id);
console.log(JSON.stringify(provider, null, 2));
