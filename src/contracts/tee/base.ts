import { getTeeProviderBase, getChainRpcBase } from "@/shared/config/api";
import { GraphqlClient } from "@/shared/api/gql";
import axios from "axios";
import {
  hexToU8a,
  stringToU8a,
  stringToHex,
  u8aToBuffer,
  u8aToHex,
} from "@polkadot/util";
import { transformUserInput } from "@/shared/utils/ink";
import { concatUint8Array } from "@/shared/utils/buffer";
import { pushToast } from "@/shared/lib/toast";
import { AbiLoader } from "./abi";
import { decodeReturnValue } from "./decoder";
import { CallContent, type WalletWrap } from "./types";

export type { EIP1193Provider, WalletWrap } from "./types";
export { CallContent } from "./types";

// ── BaseContract ──────────────────────────────────────────

export class BaseContract {
  private readonly abiLoader = new AbiLoader();
  protected readonly gqlClient: GraphqlClient;

  constructor(
    protected readonly contractName: string,
    protected readonly abiUrl: string
  ) {
    this.gqlClient = new GraphqlClient(`${getTeeProviderBase()}/gql`);
  }

  // ── Query ──────────────────────────────────────────────

  async contract_query(
    contract: string,
    method: string,
    args: Record<string, unknown>,
    caller?: string
  ) {
    const data = await this.contract_builder_query(
      contract,
      method,
      args,
      caller
    );
    if (data.dry === "Decoding error") {
      throw new Error(`Decoding error: ${contract}.${method}`);
    }
    return data.dry;
  }

  // ── Builder ────────────────────────────────────────────

  /** Resolve ink! type aliases (e.g. "store.UniAddr" -> "UniAddr").
   *  The ABI represents aliases as empty composites which Polkadot.js
   *  treats as Null type. We need to find the underlying type. */
  private _resolveAliasType(registry: unknown, typeName: string): string {
    if (typeName && typeName.includes(".")) {
      const baseName = typeName.split(".").pop()!;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((registry as any).hasType?.(baseName)) {
        return baseName;
      }
    }
    return typeName;
  }

  /** Shared ABI resolution & argument encoding */
  private async _resolveMethod(
    contract: string,
    method: string,
    args: Record<string, unknown>
  ) {
    const abi = await this.abiLoader.initContract(contract);
    const methodAbi = abi.messages.find((item) => item.method === method);
    if (!methodAbi) {
      pushToast({
        title: "Error",
        description: `Contract method not found: ${method}`,
        variant: "error",
        durationMs: 2500,
      });
      throw new Error("method not found");
    }
    const params = transformUserInput(abi.registry, methodAbi.args, args);
    const argstrs = methodAbi.args.map(
      ({ type: { lookupName, type } }, index) => {
        const resolvedType = this._resolveAliasType(
          abi.registry as unknown,
          lookupName || type
        );
        let p = abi.registry.createType(resolvedType, params[index]).toU8a();
        if (type === "Address") {
          p = p.slice(1);
        }
        return u8aToHex(p);
      }
    );
    return { abi, methodAbi, argstrs };
  }

  /** Dry-run builder for queries (no wallet needed) */
  async contract_builder_query(
    contract: string,
    method: string,
    args: Record<string, unknown>,
    caller?: string
  ) {
    const { abi, methodAbi, argstrs } = await this._resolveMethod(
      contract,
      method,
      args
    );

    const callerAddr = caller || "0x0000000000000000000000000000000000000000";
    const response = await this.tryRun(
      callerAddr,
      contract,
      methodAbi.selector.toHex(),
      argstrs,
      methodAbi.isMutating || false
    );

    const bt = hexToU8a(response);
    const returnData = decodeReturnValue(
      methodAbi.returnType,
      u8aToBuffer(bt),
      abi.registry
    );

    // console.log(" ");
    // console.log(`>>>>TEE_QUERY   Call ${contract}.${method} with args`, args);
    // console.log("TEE_QUERY<<<<  ", returnData);

    return {
      dry: returnData,
      params: {
        caller: callerAddr,
        contract,
        method: methodAbi.selector.toHex(),
        args: argstrs,
        payValue: "0",
      },
    };
  }

  /** Transaction builder for mutating calls (needs wallet for caller address) */
  async contract_builder(
    wallet: WalletWrap,
    contract: string,
    method: string,
    args: Record<string, unknown>,
    payValue: string
  ) {
    const { abi, methodAbi, argstrs } = await this._resolveMethod(
      contract,
      method,
      args
    );

    const response = await this.tryRun(
      wallet.address,
      contract,
      methodAbi.selector.toHex(),
      argstrs,
      methodAbi.isMutating || false
    );
    const bt = hexToU8a(response);
    const returnData = decodeReturnValue(
      methodAbi.returnType,
      u8aToBuffer(bt),
      abi.registry
    );

    return {
      dry: returnData,
      params: {
        caller: wallet.address,
        contract,
        method: methodAbi.selector.toHex(),
        args: argstrs,
        payValue: payValue.toString(),
      },
    };
  }

  async call_of_content(
    contract: string,
    method: string,
    args: Record<string, unknown>,
    payValue: number
  ): Promise<CallContent> {
    const abi = await this.abiLoader.initContract(contract);
    const methodAbi = abi.messages.find((item) => item.method === method);
    if (!methodAbi) {
      throw new Error("contract method not found: " + method);
    }
    const params = transformUserInput(abi.registry, methodAbi.args, args);
    const argBts = methodAbi.args.map(
      ({ type: { lookupName, type } }, index) => {
        const resolvedType = this._resolveAliasType(
          abi.registry as unknown,
          lookupName || type
        );
        // 注意: 不能使用 toHex(), 它会去掉 SCALE 长度前缀(如 Text/Vec<u8>), 导致后端按 compact len 解码出错。
        // 与 contract_builder 保持一致, 使用 toU8a() 后再转 hex。
        let p = abi.registry.createType(resolvedType, params[index]).toU8a();
        if (type === "Address") {
          p = p.slice(1);
        }
        return u8aToHex(p);
      }
    );

    return new CallContent(
      stringToHex(contract),
      methodAbi.selector.toU8a(),
      argBts,
      payValue
    );
  }

  async getSelectorMethodMap(contract: string): Promise<Map<string, string>> {
    return this.abiLoader.getSelectorMethodMap(contract);
  }

  // ── Try run (dry-run query) ────────────────────────────

  async tryRun(
    caller: string,
    contract: string,
    method: string,
    args: string[],
    mut: boolean
  ): Promise<string> {
    const argStr = JSON.stringify(args);
    const response = await this.gqlClient.query<{
      contractDryRun: string;
    }>({
      query: `query{
                contractDryRun(
                    caller:"${caller}",
                    callerType: 2,
                    contract:"${contract}",
                    mut: ${mut},
                    method: "${method}",
                    args: ${argStr}
                )
            }`,
    });

    return response.contractDryRun;
  }

  // ── Call (submit transaction) ──────────────────────────

  async call(
    wallet: WalletWrap,
    params: {
      caller: string;
      contract: string;
      method: string;
      args: string[];
    }
  ): Promise<string> {
    const { caller, contract, method, args } = params;
    const argStr = JSON.stringify(args);

    // 1. Fetch nonce before submitting
    const nonceRes = await this.gqlClient.query<{
      contractNonce: number;
    }>({
      query: `query {
                contractNonce(
                    caller: "${caller}",
                    callerType: 2
                )
            }`,
    });
    const nonce = nonceRes.contractNonce;

    // Build the raw message bytes that the contract expects
    // Format matches backend ContractForSig: <Bytes> + contractName + method[:4] + args... + nonce + </Bytes>
    // nonce is uint64 big-endian (8 bytes) to match backend Uint64ToBytes
    const nonceBytes = new Uint8Array(8);
    new DataView(nonceBytes.buffer).setBigUint64(0, BigInt(nonce), false); // false = big-endian
    const data = concatUint8Array(
      stringToU8a("<Bytes>"),
      stringToU8a(contract),
      hexToU8a(method),
      ...args.map((v) => hexToU8a(v)),
      nonceBytes,
      stringToU8a("</Bytes>")
    );

    // personal_sign expects the message as a hex string
    const messageHex =
      "call_tee_contract:" +
      Array.from(data)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

    console.log(messageHex);

    const sig = (
      (await wallet.provider.request({
        method: "personal_sign",
        params: [messageHex, caller],
      })) as string
    ).replace(/^0x/i, "");

    const response = await this.gqlClient.mut<{
      contractCall: string;
    }>({
      query: `mutation{
                contractCall(
                    caller:"${caller}",
                    callerType: 2,
                    nonce: ${nonce},
                    contract:"${contract}",
                    method: "${method}",
                    args: ${argStr},
                    signature: "${sig}"
                )
            }`,
    });

    const txHash = response.contractCall;
    const hashForQuery = txHash.startsWith("0x") ? txHash : `0x${txHash}`;
    const chainRpcBase = getChainRpcBase();

    // Poll CometBFT /tx until the transaction is found or timeout
    const maxRetries = 30;
    const intervalMs = 2000;

    // Wait a moment to allow the transaction to be submitted to the chain
    await new Promise((resolve) => setTimeout(resolve, 1000));

    for (let i = 0; i < maxRetries; i++) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));

      try {
        const rpcRes = await axios.get<{
          result?: {
            hash: string;
            height: string;
            index: number;
            tx_result: {
              code: number;
              log?: string;
            };
          };
          error?: { message?: string; data?: string };
        }>(`${chainRpcBase}/tx?hash=${hashForQuery}`);

        if (rpcRes.data.result) {
          const txResult = rpcRes.data.result.tx_result;
          if (txResult.code === 0) {
            return rpcRes.data.result.hash;
          }
          throw new Error(
            `Transaction failed: ${txResult.log || "unknown error"} (code: ${
              txResult.code
            })`
          );
        }

        // If error is not "tx not found", stop polling and throw
        const errData =
          rpcRes.data.error?.data || rpcRes.data.error?.message || "";
        if (!errData.toLowerCase().includes("tx not found")) {
          throw new Error(
            `RPC error: ${
              rpcRes.data.error?.message || JSON.stringify(rpcRes.data.error)
            }`
          );
        }
      } catch (err: unknown) {
        // Network / unexpected errors on the last iteration: throw
        if (i === maxRetries - 1) throw err;
        // Otherwise swallow and retry
      }
    }

    throw new Error(
      `Transaction not found after ${
        (maxRetries * intervalMs) / 1000
      }s: ${txHash}`
    );
  }
}
