/** EIP-1193 provider interface */
export interface EIP1193Provider {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

/** Wallet interface used by contract calls */
export interface WalletWrap {
    provider: EIP1193Provider;
    address: string;
}

export class CallContent {
    constructor(
        readonly contract: string,
        readonly selector: Uint8Array,
        readonly args: string[],
        readonly amount: number,
    ) {}
}
