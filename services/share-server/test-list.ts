import { Abi } from "@polkadot/api-contract";
import { hexToU8a, u8aToBuffer, u8aToHex } from "@polkadot/util";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decodeReturnValue } from "../../src/contracts/tee/decoder.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ABI_PATH = path.join(__dirname, "../../public/contract/gateway.json");

const TEE = process.env.TEE_API_BASE || "https://xiaobai.asyou.me:30118";
const abi = new Abi(JSON.parse(fs.readFileSync(ABI_PATH, "utf8")));
const registry = abi.registry;

const alias = (t) => (t && t.includes(".")) ? t.split(".").pop() : t;

async function dryRun(contract, method, args, mut) {
  const res = await fetch(`${TEE}/gql`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: `query{ contractDryRun(caller:"0x0000000000000000000000000000000000000000", callerType: 2, contract:"${contract}", mut: ${mut}, method: "${method}", args: ${JSON.stringify(args)}) }` }),
  });
  const json = await res.json();
  if (json.errors?.[0]) throw new Error(json.errors[0].message);
  return json.data.contractDryRun;
}

function encodeArgs(msg, input) {
  return msg.args.map(({ type }, i) => {
    let p = registry.createType(alias(type.lookupName || type.type), input[i]).toU8a();
    if (type.type === "Address") p = p.slice(1);
    return u8aToHex(p);
  });
}

async function call(label, input, mut) {
  const msg = abi.findMessage(label);
  const raw = await dryRun("gateway", msg.selector.toHex(), encodeArgs(msg, input), msg.isMutating ?? mut);
  return decodeReturnValue(msg.returnType, u8aToBuffer(hexToU8a(raw)), registry);
}

const count = await call("get_provider_count", []);
console.log("provider count:", count);

const lap = await call("list_active_providers", [0, 5]);
console.log("list_active_providers sample:", JSON.stringify(lap, null, 2).slice(0, 800));

const lpm = await call("list_provider_models", [1]);
console.log("list_provider_models[1] sample:", JSON.stringify(lpm, null, 2).slice(0, 800));
