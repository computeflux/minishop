import { useQuery } from "@tanstack/react-query";
import { parseChainNumber, sameAddress } from "@/shared/utils";
import type {
  ProviderInfo,
  ModelInfoWithID,
  ModelInfoV2,
  ProviderSettlementRecord,
  UserSettlementRecord,
  RechargeRecord,
} from "@/contracts/tee/types/gateway";

/**
 * 契约 API 懒加载：@polkadot 栈（~1.4MB）拆成独立 chunk，仅在真正读链时加载。
 * 大 chunk 在弱网/跨境链路上极易传输截断，若作为页面静态依赖会连带打挂整个页面
 * （Home 的 Connect 按钮等全部失效）；拆出后加载失败只影响链上数据。
 */
type GatewayApi = (typeof import("@/contracts/tee/gateway"))["GatewayContractApi"];
let gatewayApiPromise: Promise<typeof import("@/contracts/tee/gateway")> | null = null;
export async function gateway(): Promise<GatewayApi> {
    gatewayApiPromise ??= import("@/contracts/tee/gateway");
    return (await gatewayApiPromise).GatewayContractApi;
}

/** Seller revenue — settlements on a provider's models (NOT user spend) */
export function useProviderSettlements(providerID: number | undefined) {
  return useQuery({
    queryKey: ["minishop", "providerSettlements", providerID],
    queryFn: async () => (await gateway()).getSettlementHistory(providerID!, 0, 100),
    enabled: providerID != null && Number.isFinite(providerID),
  });
}

/**
 * 单个店铺（私域）= 店铺身份 + 店主个人的模型。
 *
 * 模型获取参考 dapp dashboard（ModelsSection）的单人模式：
 *   getProviderByOwner(owner) → listProviderModels(personalId)
 * 再按 Owner 过滤——个人的店铺只展示店主本人注册的模型，
 * 链上其他来源（他人注册、共享等）的模型一律不进店铺页。
 *
 * activeOnly：店铺页是橱窗，只展示在售（active）模型；
 * 卖家后台传 false，展示全部（含已停用，用于管理）。
 */
export function useShop(
  id: number | undefined,
  opts?: { activeOnly?: boolean }
) {
  const activeOnly = opts?.activeOnly ?? false;
  return useQuery({
    queryKey: ["minishop", "shop", id, activeOnly ? "active" : "all"],
    queryFn: () => fetchShop(id, activeOnly),
    enabled: id != null && Number.isFinite(id),
  });
}

/**
 * shop 橱窗数据（店铺身份 + 店主本人的模型）。SSR 服务端预取与本 hook 共用同一函数。
 * 逻辑：getProvider → 按 Owner 解析个人 provider → listProviderModels(personal) → 按 Owner 过滤。
 */
export async function fetchShop(
  id: number | undefined,
  activeOnly = false
): Promise<{ provider: ProviderInfo; models: ModelInfoWithID[] } | null> {
  if (id == null || !Number.isFinite(id)) return null;
  const api = await gateway();
  const provider = await api.getProvider(id);
  const owner = provider?.Owner?.V;

  // dapp 模式：按店主的钱包地址解析其个人 provider，再取其模型
  let pid = id;
  if (owner) {
    const personalRaw = await api.getProviderByOwner(owner);
    const personal = personalRaw ? parseChainNumber(personalRaw) : NaN;
    if (Number.isFinite(personal) && personal > 0) pid = personal;
  }

  const all = await api.listProviderModels(pid);
  const personal = (all ?? []).filter(
    (m) => !owner || sameAddress(m.Data?.Owner?.V, owner)
  );
  const models = activeOnly
    ? personal.filter((m) => m.Data.IsActive)
    : personal;

  return { provider, models } as {
    provider: ProviderInfo;
    models: ModelInfoWithID[];
  };
}

/** A single compute model (+ its shop) */
export function useModel(id: number | undefined) {
  return useQuery({
    queryKey: ["minishop", "model", id],
    queryFn: async () => {
      if (id == null) return null;
      const api = await gateway();
      const model = await api.getModel(id);
      const provider = await api.getProvider(Number(model.ProviderID));
      return { model, provider } as {
        model: ModelInfoV2;
        provider: ProviderInfo;
      };
    },
    enabled: id != null && Number.isFinite(id),
  });
}

/**
 * 平台店铺列表（分页）— 首页「全部店铺」区块使用。
 * 走链上 listActiveProviders（仅在售店铺），offset/limit 分页。
 * 未登录用户也可浏览（纯读操作，无需钱包）。
 *
 * 分页口径：链上只有 getProviderCount（含已停用店铺总数）与 listActiveProviders
 * （仅在售）两个来源，口径不一致会导致总页数偏大、末页空白。故不取 total，
 * 改以「本页是否满页」推断是否还有下一页（hasMore = providers.length === pageSize），
 * 与列表数据完全同源。
 */
export function useShopList(page: number, pageSize = 12) {
  const offset = (page - 1) * pageSize;
  return useQuery({
    queryKey: ["minishop", "shopList", page, pageSize],
    queryFn: async () => {
      const api = await gateway();
      const providers = (await api.listActiveProviders(offset, pageSize)) ?? [];
      return { providers, hasMore: providers.length === pageSize };
    },
    staleTime: 30_000,
  });
}

/** The current wallet's shop (if any) */
export function useMyProvider(owner: string | undefined) {
  return useQuery({
    queryKey: ["minishop", "myProvider", owner],
    queryFn: async () => (await gateway()).getProviderByOwner(owner!),
    enabled: Boolean(owner),
  });
}

/** Credit (points) balance for a user */
export function useCredit(user: string | undefined) {
  return useQuery({
    queryKey: ["minishop", "credit", user],
    queryFn: async () => (await gateway()).getCredit(user!),
    enabled: Boolean(user),
  });
}

/** 店铺余额度（provider credit）— 买家消费结算进入，可提现 */
export function useProviderCredit(providerID: number | undefined) {
  return useQuery({
    queryKey: ["minishop", "providerCredit", providerID],
    queryFn: async () => (await gateway()).getProviderCredit(providerID!),
    enabled: providerID != null,
  });
}

/** Settlement (spend) history for a user */
export function useSettlementHistory(user: string | undefined, limit = 50) {
  return useQuery({
    queryKey: ["minishop", "settlement", user],
    queryFn: async () => (await gateway()).getUserSettlementHistory(user!, 0, limit),
    enabled: Boolean(user),
  });
}

/** Recharge history for a user */
export function useRechargeHistory(user: string | undefined, limit = 50) {
  return useQuery({
    queryKey: ["minishop", "recharge", user],
    queryFn: async () => (await gateway()).getRechargeHistory(user!, 0, limit),
    enabled: Boolean(user),
  });
}

export type { ProviderInfo, ModelInfoWithID, ModelInfoV2, ProviderSettlementRecord, UserSettlementRecord, RechargeRecord };
