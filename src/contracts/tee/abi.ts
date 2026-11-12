import axios from "axios";
import fs from "node:fs";
import path from "node:path";
import { Abi } from "@polkadot/api-contract";

export class AbiLoader {
    private readonly cache = new Map<string, Abi>();

    async initContract(contract: string): Promise<Abi> {
        const cached = this.cache.get(contract);
        if (cached) return cached;

        const abi = await this.fetchAbi(`contract/${contract}.json`);
        this.cache.set(contract, abi);
        return abi;
    }

    private async fetchAbi(url: string): Promise<Abi> {
        if (typeof window === "undefined") {
            // SSR：从本地文件系统读取 ABI（静态产物，无需网络）。
            // 默认 public/contract/*.json（相对 cwd）；ABI_DIR 可覆盖（部署时指向 dist-ssr/contract）。
            const dir = process.env.ABI_DIR
                ? process.env.ABI_DIR
                : path.resolve(process.cwd(), "public");
            const raw = fs.readFileSync(path.join(dir, url), "utf-8");
            return new Abi(JSON.parse(raw));
        }
        // 客户端：相对部署 base 加载 public/contract/*.json（如 /shops/contract/gateway.json）
        const base = import.meta.env.BASE_URL;
        const response = await axios.get(`${base}${url}`);
        return new Abi(response.data);
    }

    async getSelectorMethodMap(contract: string): Promise<Map<string, string>> {
        const abi = await this.initContract(contract);
        const map = new Map<string, string>();
        for (const msg of abi.messages) {
            map.set(msg.selector.toHex().toLowerCase(), msg.method);
        }
        return map;
    }
}
