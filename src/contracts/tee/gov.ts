import { u8aToHex } from "@polkadot/util";
import { BaseContract, type WalletWrap } from "./base";
import type { CallContent } from "./types";
import type { SudoResponse, IsSudoDisabledResponse } from "./types/gov";

/**
 * Gov 合约 — DAO 治理（Token、提案、投票、资金管理）
 */
export class GovContract extends BaseContract {
    constructor() {
        super("gov", "contract/gov.json");
    }

    // ============ Sudo ============

    async sudo(): Promise<SudoResponse> {
        return (await this.contract_query("gov", "sudo", {})) as unknown as SudoResponse;
    }

    async isSudoDisabled(): Promise<IsSudoDisabledResponse> {
        return (await this.contract_query("gov", "isSudoDisabled", {})) as unknown as IsSudoDisabledResponse;
    }

    async callAsSudo(wallet: WalletWrap, calls: CallContent[]) {
        const result = await this.contract_builder(
            wallet,
            "gov",
            "callAsSudo",
            {
                calls: calls.map((c) => ({
                    Name: c.contract,
                    Method: u8aToHex(c.selector),
                    Args: c.args,
                })),
            },
            "0",
        );
        return await this.call(wallet, result.params);
    }

    // ============ Token & Allowance ============

    async allowance(owner: string, spender: string) {
        return await this.contract_query("gov", "allowance", {
            owner,
            spender,
        });
    }

    async approve(wallet: WalletWrap, spender: string, value: string) {
        const result = await this.contract_builder(wallet, 
            "gov",
            "approve",
            { spender, value },
            "0",
        );
        return await this.call(wallet, result.params);
    }

    async balanceOf(owner: string) {
        return await this.contract_query("gov", "balanceOf", {
            owner: { T: 2, V: owner },
        });
    }

    async transfer(wallet: WalletWrap, to: string, value: string) {
        const result = await this.contract_builder(wallet, 
            "gov",
            "transfer",
            { to, value },
            "0",
        );
        return await this.call(wallet, result.params);
    }

    async transferFrom(
        wallet: WalletWrap,
        from: string,
        to: string,
        value: string,
    ) {
        const result = await this.contract_builder(wallet, 
            "gov",
            "transferFrom",
            { from, to, value },
            "0",
        );
        return await this.call(wallet, result.params);
    }

    async totalSupply() {
        return await this.contract_query("gov", "totalSupply", {});
    }

    // ============ Membership ============

    async members() {
        return await this.contract_query("gov", "members", {});
    }

    async join(wallet: WalletWrap) {
        const result = await this.contract_builder(wallet, "gov", "join", {}, "0");
        return await this.call(wallet, result.params);
    }

    async leave(wallet: WalletWrap) {
        const result = await this.contract_builder(wallet, "gov", "leave", {}, "0");
        return await this.call(wallet, result.params);
    }

    async leaveWithBurn(wallet: WalletWrap, burn: string) {
        const result = await this.contract_builder(wallet, 
            "gov",
            "leaveWithBurn",
            { burn },
            "0",
        );
        return await this.call(wallet, result.params);
    }

    async getPublicJoin() {
        return await this.contract_query("gov", "getPublicJoin", {});
    }

    async setPublicJoin(wallet: WalletWrap, enabled: boolean) {
        const result = await this.contract_builder(wallet, 
            "gov",
            "setPublicJoin",
            { enabled },
            "0",
        );
        return await this.call(wallet, result.params);
    }

    async publicJoin(wallet: WalletWrap) {
        const result = await this.contract_builder(wallet, 
            "gov",
            "publicJoin",
            {},
            "0",
        );
        return await this.call(wallet, result.params);
    }

    // ============ Tracks ============

    async defaultTrack() {
        return await this.contract_query("gov", "defaultTrack", {});
    }

    async setDefaultTrack(wallet: WalletWrap, trackID: number) {
        const result = await this.contract_builder(wallet, 
            "gov",
            "setDefaultTrack",
            { trackID },
            "0",
        );
        return await this.call(wallet, result.params);
    }

    async addTrack(name: string, description: string) {
        return await this.contract_builder_query( 
            "gov",
            "addTrack",
            { name, description },
        );
    }

    async track(trackID: number) {
        return await this.contract_query("gov", "track", { trackID });
    }

    async tracks() {
        return await this.contract_query("gov", "tracks", {});
    }

    // ============ Proposals ============

    async submitProposal(
        wallet: WalletWrap,
        title: string,
        description: string,
        color: string,
        duration: number,
    ) {
        const result = await this.contract_builder(wallet, 
            "gov",
            "submitProposal",
            { title, description, color, duration },
            "0",
        );
        return await this.call(wallet, result.params);
    }

    async proposal(id: number) {
        return await this.contract_query("gov", "proposal", { id });
    }

    async proposalStatus(id: number) {
        return await this.contract_query("gov", "proposalStatus", { id });
    }

    async proposalsPage(startKey: number | null, size: number) {
        const result = await this.contract_query(
            "gov",
            "proposalsPage",
            { startKey, size }
        );
        return result;
    }

    async proposals() {
        return await this.contract_query("gov", "proposals", {});
    }

    async cancelProposal(wallet: WalletWrap, id: number) {
        const result = await this.contract_builder(wallet, 
            "gov",
            "cancelProposal",
            { id },
            "0",
        );
        return await this.call(wallet, result.params);
    }

    async depositProposal(proposalID: number) {
        return await this.contract_builder_query( 
            "gov",
            "depositProposal",
            { proposalID },
        );
    }

    async depositProposalTx(wallet: WalletWrap, proposalID: number) {
        const result = await this.contract_builder(wallet, 
            "gov",
            "depositProposal",
            { proposalID },
            "0",
        );
        return await this.call(wallet, result.params);
    }

    async execProposal(wallet: WalletWrap, id: number) {
        const result = await this.contract_builder(wallet, 
            "gov",
            "execProposal",
            { id },
            "0",
        );
        return await this.call(wallet, result.params);
    }

    // ============ Votes ============

    async submitVote(wallet: WalletWrap, proposalID: number, approve: boolean) {
        const result = await this.contract_builder(wallet, 
            "gov",
            "submitVote",
            { proposalID, approve },
            "0",
        );
        return await this.call(wallet, result.params);
    }

    async vote(proposalID: number, user: string) {
        return await this.contract_query("gov", "vote", { proposalID, user });
    }

    async votes(proposalID: number) {
        return await this.contract_query("gov", "votes", { proposalID });
    }

    async votesOfUser(user: string) {
        return await this.contract_query("gov", "votesOfUser", {
            user: { T: 2, V: user },
        });
    }

    async cancelVote(wallet: WalletWrap, proposalID: number) {
        const result = await this.contract_builder(wallet, 
            "gov",
            "cancelVote",
            { proposalID },
            "0",
        );
        return await this.call(wallet, result.params);
    }

    // ============ Treasury ============

    async spend(
        wallet: WalletWrap,
        trackID: number,
        amount: string,
        beneficiary: string,
    ) {
        const result = await this.contract_builder(wallet, 
            "gov",
            "spend",
            { trackID, amount, beneficiary },
            "0",
        );
        return await this.call(wallet, result.params);
    }

    async payout(wallet: WalletWrap, trackID: number, beneficiary: string) {
        const result = await this.contract_builder(wallet, 
            "gov",
            "payout",
            { trackID, beneficiary },
            "0",
        );
        return await this.call(wallet, result.params);
    }

    // ============ Init ============

    async init(wallet: WalletWrap) {
        const result = await this.contract_builder(wallet, "gov", "Init", {}, "0");
        return await this.call(wallet, result.params);
    }
}

export const GovContractApi = new GovContract();
