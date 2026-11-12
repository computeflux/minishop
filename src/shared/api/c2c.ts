import { getC2cApiBase } from "@/shared/config/api";

/**
 * C2C 买家侧公开接口（无需登录，用链上地址标识买家）：
 *   - `POST /c2c/public/orders`            外部下单（`Idempotency-Key` 必传）
 *   - `GET  /c2c/public/orders/:order_no`  订单进度查询（`?buyer_address=` 必传，校验归属）
 */

/** 订单进度阶段（由订单状态 + 渠道收款凭证推导） */
export type C2cOrderStage =
  | "awaiting_payment"
  | "releasing"
  | "completed"
  | "failed"
  | "canceled"
  | "awaiting_review";

export type C2cStepState = "pending" | "doing" | "done" | "failed";

export interface C2cOrderStep {
  key: string;
  label: string;
  state: C2cStepState;
}

export interface C2cOrderStatus {
  order_no: string;
  status: string;
  stage: C2cOrderStage;
  message: string;
  steps: C2cOrderStep[];
  channel: string;
  amount: string;
  currency: string;
  /** 渠道已确认付款（存在 received 收款凭证）时返回 */
  txn_ref?: string;
  /** 订单超时取消时刻（RFC3339） */
  expires_at?: string;
}

/** 下单响应（含明文付款指令，仅下单响应与 pending 订单详情对买家返回） */
export interface C2cOrderCreated {
  order_no: string;
  status: string;
  listing_id?: number;
  merchant_id?: string;
  currency?: string;
  locked_rate?: number;
  points_amount?: number;
  buyer_get_points?: number;
  price_amount?: number;
  expires_at?: string;
  payment?: {
    channel: string;
    confirm_mode?: string;
    instruction?: { type: string; value: string; account_name?: string };
  };
}

export interface CreateC2cOrderInput {
  /** 买家链上地址（EVM 0x…）= 下单身份；链上买家余额/放款按该地址记账 */
  buyerAddress: string;
  /** 积分数量（链上单位，与登录版 /c2c/orders 一致） */
  pointsAmount: number;
  currency: string;
  /** 支付渠道（可选；未传则沿用该地址保存的买家偏好） */
  channel?: string;
  /** 幂等键（`Idempotency-Key` 头，必传，1-64 字符） */
  idempotencyKey: string;
}

/** 终态：不再变化，前端停止轮询 */
export function isTerminalStage(stage: string | undefined): boolean {
  return stage === "completed" || stage === "failed" || stage === "canceled";
}

/** 统一解析 `{"ok":true,"data":…}` 信封；失败抛出后端的 error.message */
async function parseEnvelope<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => null)) as {
    ok?: boolean;
    data?: T;
    error?: { code?: string; message?: string };
  } | null;
  if (!res.ok || !body?.ok || body.data === undefined) {
    throw new Error(body?.error?.message || `HTTP ${res.status}`);
  }
  return body.data;
}

/** 外部下单（无需登录）：买家用链上地址标识自身，返回含明文付款指令 */
export async function createC2cOrder(
  input: CreateC2cOrderInput
): Promise<C2cOrderCreated> {
  const res = await fetch(`${getC2cApiBase()}/c2c/public/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      buyer_address: input.buyerAddress,
      points_amount: input.pointsAmount,
      currency: input.currency,
      ...(input.channel ? { channel: input.channel } : {}),
    }),
  });
  return parseEnvelope<C2cOrderCreated>(res);
}

/**
 * 订单进度查询（无需登录；`buyer_address` 与订单买家不匹配则 404）
 * @param buyerAddress 下单时使用的链上地址（大小写不敏感）
 */
export async function fetchC2cOrderStatus(
  orderNo: string,
  buyerAddress: string
): Promise<C2cOrderStatus> {
  const query = new URLSearchParams({ buyer_address: buyerAddress }).toString();
  const res = await fetch(
    `${getC2cApiBase()}/c2c/public/orders/${encodeURIComponent(orderNo)}?${query}`
  );
  return parseEnvelope<C2cOrderStatus>(res);
}
