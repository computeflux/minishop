import { BaseContract, type WalletWrap } from "./base";
import { GovContractApi } from "./gov";
import type {
  GetCreditResponse,
  GetModelCountResponse,
  GetProviderCountResponse,
  GetProviderByOwnerResponse,
  ListModelsResponse,
  ListActiveModelsResponse,
  ListProvidersResponse,
  ListActiveProvidersResponse,
  GetModelResponse,
  GetModelsResponse,
  GetModelByNameResponse,
  GetProviderResponse,
  LookupAPIKeyResponse,
  QueryModelsResponse,
  GetProviderCreditResponse,
  GetAPIKeysByOwnerResponse,
  GetSettlementHistoryResponse,
  GetUserSettlementHistoryResponse,
  GetRechargeHistoryResponse,
  ListActiveModelsWithinProviderResponse,
  ListProviderModelsResponse,
  WithdrawalsByUserResponse,
  GetRouteResponse,
  ListRoutesResponse,
} from "./types/gateway";

/**
 * Gateway 合约 — API 网关（模型、供应商、积分）
 */
export class GatewayContract extends BaseContract {
  constructor() {
    super("gateway", "contract/gateway.json");
  }

  // ── 模型 ────────────────────────────────────────────────

  async registerModel(
    wallet: WalletWrap,
    name: string,
    inputModalities: number,
    contextLength: number,
    inPrice: number,
    cachedPrice: number,
    outPrice: number,
    modelType: number,
    uris: string,
    apiKeys: string[],
    maxConcurrency: number,
    balance: string,
    thinking: boolean,
    meta: string
  ) {
    const result = await this.contract_builder(
      wallet,
      "gateway",
      "registerModel",
      {
        name,
        inputModalities,
        contextLength,
        inPrice,
        cachedPrice,
        outPrice,
        // 链上参数名为 provider_type（camelCase 为 providerType），旧代码传 modelType 映射不到、恒编码为 0
        providerType: modelType,
        uri: uris,
        apiKeys,
        maxConcurrency,
        balance,
        thinking,
        meta,
      },
      "0"
    );
    return await this.call(wallet, result.params);
  }

  async updateModel(
    wallet: WalletWrap,
    modelID: number,
    inputModalities: number,
    contextLength: number,
    inPrice: number,
    cachedPrice: number,
    outPrice: number,
    modelType: number,
    uris: string,
    maxConcurrency: number,
    balance: string,
    thinking: boolean,
    meta: string
  ) {
    const result = await this.contract_builder(
      wallet,
      "gateway",
      "updateModel",
      {
        iD: modelID,
        inputModalities,
        contextLength,
        inPrice,
        cachedPrice,
        outPrice,
        // 同 registerModel：链上参数名为 providerType
        providerType: modelType,
        uri: uris,
        maxConcurrency,
        balance,
        thinking,
        meta,
      },
      "0"
    );
    return await this.call(wallet, result.params);
  }

  async addModelApiKeyRef(wallet: WalletWrap, modelID: number, apiKey: string) {
    const result = await this.contract_builder(
      wallet,
      "gateway",
      "addModelAPIKeyRef",
      { modelID, apiKey },
      "0"
    );
    return await this.call(wallet, result.params);
  }

  async deleteModelApiKeyRef(
    wallet: WalletWrap,
    modelID: number,
    index: number
  ) {
    const result = await this.contract_builder(
      wallet,
      "gateway",
      "deleteModelAPIKeyRef",
      { modelID, index },
      "0"
    );
    return await this.call(wallet, result.params);
  }

  async updateModelApiKeyRef(
    wallet: WalletWrap,
    modelID: number,
    index: number,
    newApiKey: string
  ) {
    const result = await this.contract_builder(
      wallet,
      "gateway",
      "updateModelAPIKeyRef",
      { modelID, index, newApiKey },
      "0"
    );
    return await this.call(wallet, result.params);
  }

  async deactivateModel(wallet: WalletWrap, modelID: number) {
    const result = await this.contract_builder(
      wallet,
      "gateway",
      "deactivateModel",
      { modelID },
      "0"
    );
    return await this.call(wallet, result.params);
  }

  async activeModel(wallet: WalletWrap, modelID: number) {
    const result = await this.contract_builder(
      wallet,
      "gateway",
      "activeModel",
      { modelID },
      "0"
    );
    return await this.call(wallet, result.params);
  }

  async getModel(modelID: number): Promise<GetModelResponse> {
    return (await this.contract_query("gateway", "getModel", {
      modelID,
    })) as unknown as GetModelResponse;
  }

  async getModels(modelIDs: number[]): Promise<GetModelsResponse> {
    return (await this.contract_query("gateway", "getModels", {
      iDs: modelIDs,
    })) as unknown as GetModelsResponse;
  }

  async getModelByName(
    providerID: number,
    name: string
  ): Promise<GetModelByNameResponse> {
    return (await this.contract_query("gateway", "getModelByName", {
      pid: providerID,
      name,
    })) as unknown as GetModelByNameResponse;
  }

  async getModelCount(): Promise<GetModelCountResponse> {
    return (await this.contract_query(
      "gateway",
      "getModelCount",
      {}
    )) as unknown as GetModelCountResponse;
  }

  async listModels(offset: number, limit: number): Promise<ListModelsResponse> {
    return (await this.contract_query("gateway", "listModels", {
      offset,
      limit,
    })) as unknown as ListModelsResponse;
  }

  async listActiveModels(
    offset: number,
    limit: number
  ): Promise<ListActiveModelsResponse> {
    return (await this.contract_query("gateway", "listActiveModels", {
      offset,
      limit,
    })) as unknown as ListActiveModelsResponse;
  }

  async queryModels(
    modalities: number,
    minContext: number,
    maxContext: number,
    maxPrice: number,
    offset: number,
    limit: number
  ): Promise<QueryModelsResponse> {
    return (await this.contract_query("gateway", "queryModels", {
      modalities,
      minContext,
      maxContext,
      maxPrice,
      offset,
      limit,
    })) as unknown as QueryModelsResponse;
  }

  // ── 供应商 ──────────────────────────────────────────────
  async createProvider(
    wallet: WalletWrap,
    name: string,
    logoURL: string,
    description: string,
    region: number,
    deposit: number
  ) {
    const result = await this.contract_builder(
      wallet,
      "gateway",
      "createProvider",
      { name, logoURL, description, region, deposit },
      "0"
    );
    return await this.call(wallet, result.params);
  }

  async updateProvider(
    wallet: WalletWrap,
    providerID: number,
    name: string,
    logoURL: string,
    description: string,
    modelIds: number[],
    region: number,
    feeRate: number,
    priority: number,
    uptimeSLA: number
  ) {
    const result = await this.contract_builder(
      wallet,
      "gateway",
      "updateProvider",
      {
        providerID,
        name,
        logoURL,
        description,
        modelIds,
        region,
        feeRate,
        priority,
        uptimeSLA,
      },
      "0"
    );
    return await this.call(wallet, result.params);
  }

  async getProvider(providerID: number): Promise<GetProviderResponse> {
    return (await this.contract_query("gateway", "getProvider", {
      providerID: providerID,
    })) as unknown as GetProviderResponse;
  }

  async getProviderByOwner(owner: string): Promise<GetProviderByOwnerResponse> {
    // get_provider_by_owner takes no args; it reads the caller address from the dry-run context
    return (await this.contract_query(
      "gateway",
      "getProviderByOwner",
      {},
      owner
    )) as unknown as GetProviderByOwnerResponse;
  }

  async getProviderCount(): Promise<GetProviderCountResponse> {
    return (await this.contract_query(
      "gateway",
      "getProviderCount",
      {}
    )) as unknown as GetProviderCountResponse;
  }

  async listProviders(
    offset: number,
    limit: number
  ): Promise<ListProvidersResponse> {
    return (await this.contract_query("gateway", "listProviders", {
      offset,
      limit,
    })) as unknown as ListProvidersResponse;
  }

  async listActiveProviders(
    offset: number,
    limit: number
  ): Promise<ListActiveProvidersResponse> {
    return (await this.contract_query("gateway", "listActiveProviders", {
      offset,
      limit,
    })) as unknown as ListActiveProvidersResponse;
  }

  // ── 积分 ────────────────────────────────────────────────

  async getCredit(user: string): Promise<GetCreditResponse> {
    const raw = await this.contract_query("gateway", "getCredit", {
      user: {
        T: 2,
        V: user,
      },
    });

    // Backend may return numbers with comma separators (e.g. "99,999")
    if (typeof raw === "string") {
      return raw.replace(/,/g, "") as unknown as GetCreditResponse;
    }

    return raw as unknown as GetCreditResponse;
  }

  async recharge(wallet: WalletWrap, user: string, amount: number) {
    const result = await this.contract_builder(
      wallet,
      "gateway",
      "recharge",
      { user, amount },
      "0"
    );
    return await this.call(wallet, result.params);
  }

  async transferCredit(wallet: WalletWrap, to: string, amount: number) {
    const result = await this.contract_builder(
      wallet,
      "gateway",
      "transferCredit",
      {
        to: { T: 2, V: to },
        amount,
      },
      "0"
    );
    return await this.call(wallet, result.params);
  }

  async settleUsage(wallet: WalletWrap, records: unknown[]) {
    const result = await this.contract_builder(
      wallet,
      "gateway",
      "settleUsage",
      { records },
      "0"
    );
    return await this.call(wallet, result.params);
  }

  async applyWithdraw(
    wallet: WalletWrap,
    chainID: number,
    token: string,
    providerID: number,
    amount: number,
    nonce: string
  ) {
    console.log({ chainID, token, providerID, amount, nonce });
    const result = await this.contract_builder(
      wallet,
      "gateway",
      "applyWithdraw",
      { chainID, token, providerID, amount, nonce },
      "0"
    );
    return await this.call(wallet, result.params);
  }

  async getProviderCredit(
    providerID: number
  ): Promise<GetProviderCreditResponse> {
    return (await this.contract_query("gateway", "getProviderCredit", {
      providerID,
    })) as unknown as GetProviderCreditResponse;
  }

  // ── API Key ────────────────────────────────────────────

  async registerAPIKey(wallet: WalletWrap, keyHash: string, prefix: string, rateLimit: number) {
    const result = await this.contract_builder(
      wallet,
      "gateway",
      "registerAPIKey",
      { keyHash, rateLimit, prefix },
      "0"
    );
    console.log({ keyHash, rateLimit, prefix });
    return await this.call(wallet, result.params);
  }

  async updateAPIKey(wallet: WalletWrap, keyHash: string, rateLimit: number) {
    const result = await this.contract_builder(
      wallet,
      "gateway",
      "updateAPIKey",
      { keyHash, rateLimit },
      "0"
    );
    return await this.call(wallet, result.params);
  }

  async revokeAPIKey(wallet: WalletWrap, keyHash: string) {
    const result = await this.contract_builder(
      wallet,
      "gateway",
      "revokeAPIKey",
      { keyHash },
      "0"
    );
    return await this.call(wallet, result.params);
  }

  async lookupAPIKey(keyHash: string): Promise<LookupAPIKeyResponse> {
    return (await this.contract_query("gateway", "lookupAPIKey", {
      keyHash,
    })) as unknown as LookupAPIKeyResponse;
  }

  async getAPIKeysByOwner(owner: string): Promise<GetAPIKeysByOwnerResponse> {
    return (await this.contract_query("gateway", "getAPIKeysByOwner", {
      owner: { T: 2, V: owner },
    })) as unknown as GetAPIKeysByOwnerResponse;
  }

  async getSettlementHistory(
    providerID: number,
    offset: number,
    limit: number
  ): Promise<GetSettlementHistoryResponse> {
    return (await this.contract_query("gateway", "getSettlementHistory", {
      providerID,
      offset,
      limit,
    })) as unknown as GetSettlementHistoryResponse;
  }

  async getUserSettlementHistory(
    user: string,
    offset: number,
    limit: number
  ): Promise<GetUserSettlementHistoryResponse> {
    return (await this.contract_query("gateway", "getUserSettlementHistory", {
      user: { T: 2, V: user },
      offset,
      limit,
    })) as unknown as GetUserSettlementHistoryResponse;
  }

  async getRechargeHistory(
    user: string,
    offset: number,
    limit: number
  ): Promise<GetRechargeHistoryResponse> {
    return (await this.contract_query("gateway", "getRechargeHistory", {
      user: { T: 2, V: user },
      offset,
      limit,
    })) as unknown as GetRechargeHistoryResponse;
  }

  async listActiveModelsWithinProvider(
    minContext: number,
    maxContext: number,
    minPrice: number,
    maxPrice: number,
    offset: number,
    limit: number
  ): Promise<ListActiveModelsWithinProviderResponse> {
    return (await this.contract_query(
      "gateway",
      "listActiveModelsWithinProvider",
      { minContext, maxContext, minPrice, maxPrice, offset, limit }
    )) as unknown as ListActiveModelsWithinProviderResponse;
  }

  async listProviderModels(
    providerID: number
  ): Promise<ListProviderModelsResponse> {
    return (await this.contract_query("gateway", "listProviderModels", {
      providerID: providerID,
    })) as unknown as ListProviderModelsResponse;
  }

  async withdrawalsByUser(
    user: string,
    offset: number,
    limit: number
  ): Promise<WithdrawalsByUserResponse> {
    return (await this.contract_query("gateway", "withdrawalsByUser", {
      user: { T: 2, V: user },
      offset,
      limit,
    })) as unknown as WithdrawalsByUserResponse;
  }

  // ── 初始化 ──────────────────────────────────────────────

  async init(wallet: WalletWrap) {
    const result = await this.contract_builder(
      wallet,
      "gateway",
      "init",
      {},
      "0"
    );
    return await this.call(wallet, result.params);
  }

  // ── Route ───────────────────────────────────────────────

  async getRoute(routeID: number): Promise<GetRouteResponse> {
    return (await this.contract_query("gateway", "getRoute", {
      routeID,
    })) as unknown as GetRouteResponse;
  }

  async listRoutes(offset: number, limit: number): Promise<ListRoutesResponse> {
    return (await this.contract_query("gateway", "listRoutes", {
      offset,
      limit,
    })) as unknown as ListRoutesResponse;
  }

  async createRouteAsSudo(
    wallet: WalletWrap,
    name: string,
    routeType: number,
    inPrice: number,
    cachedPrice: number,
    outPrice: number,
    isOfficial: boolean
  ) {
    const content = await this.call_of_content(
      "gateway",
      "createRoute",
      { name, routeType, inPrice, cachedPrice, outPrice, isOfficial },
      0
    );
    return await GovContractApi.callAsSudo(wallet, [content]);
  }

  async updateRouteAsSudo(
    wallet: WalletWrap,
    routeID: number,
    name: string,
    inPrice: number,
    cachedPrice: number,
    outPrice: number,
    isActive: boolean
  ) {
    const content = await this.call_of_content(
      "gateway",
      "updateRoute",
      { routeID, name, inPrice, cachedPrice, outPrice, isActive },
      0
    );
    return await GovContractApi.callAsSudo(wallet, [content]);
  }

  async deleteRoute(wallet: WalletWrap, routeID: number) {
    return this.contract_builder(
      wallet,
      "gateway",
      "deleteRoute",
      {
        routeID,
      },
      "0"
    );
  }

  async joinRoute(
    wallet: WalletWrap,
    modelID: number,
    routeID: number
  ): Promise<string> {
    const result = await this.contract_builder(
      wallet,
      "gateway",
      "joinRoute",
      { routeID, modelID },
      "0"
    );

    return await this.call(wallet, result.params);
  }

  async leaveRoute(
    wallet: WalletWrap,
    modelID: number,
    routeID: number
  ): Promise<string> {
    const result = await this.contract_builder(
      wallet,
      "gateway",
      "leaveRoute",
      { routeID, modelID },
      "0"
    );

    return await this.call(wallet, result.params);
  }
}

export const GatewayContractApi = new GatewayContract();
