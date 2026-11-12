import { create } from "zustand";
import { GatewayContractApi } from "@/contracts/tee/gateway";
import type { EIP1193Provider } from "@/contracts/tee/types";
import type { RechargeRecord } from "@/contracts/tee/types/gateway";

export type RechargeStatus = "idle" | "pending" | "success";

interface RechargeState {
  status: RechargeStatus;
  history: RechargeRecord[];
  error: string | null;
  userAddress: string | null;
  mainChainTxHash: string | null;
  _baseline: number;
  /** 基线快照中最新一条记录的 Time+Amount，用于判定新记录（避免 limit=100 截断导致长度不变） */
  _baselineLatest: string | null;
  /** 代际计数：每次 startPolling/dismiss 递增，异步闭包在 await 后校验是否仍是最新一次 */
  _generation: number;
  _intervalTimer: ReturnType<typeof setInterval> | null;
  _timeoutTimer: ReturnType<typeof setTimeout> | null;

  /**
   * Start tracking a recharge.
   *
   * 1. Immediately fetch the current recharge history as the baseline.
   * 2. Show "pending" status so the user knows the TEE-chain is being watched.
   * 3. Poll getRechargeHistory until a new entry appears (success) or timeout.
   * 4. If a main-chain txHash is provided, also wait for the receipt and stop
   *    polling early if the main-chain transaction fails.
   */
  startPolling: (
    userAddress: string,
    provider?: EIP1193Provider,
    txHash?: string
  ) => void;
  dismiss: () => void;
  _fetchHistory: () => Promise<void>;
  _clearTimers: () => void;
}

const POLL_INTERVAL = 8000;
const POLL_TIMEOUT = 5 * 60 * 1000;
const MAIN_CHAIN_CONFIRMATION_TIMEOUT = 3 * 60 * 1000;

/** 记录唯一标识：Time + Amount，用于判定基线之后是否出现新记录 */
function recordKey(r: RechargeRecord): string {
  return `${r.Time}:${r.Amount}`;
}

/**
 * 取「最新一条记录」的 recordKey：按 Time 取最大值，不依赖接口返回顺序。
 * TEE 链历史类查询为升序返回（同仓库 WithdrawCard.tsx 对 withdrawalsByUser 结果
 * 做了 reverse() 才最新在前），list[0] 是最旧一条；若按 list[0] 判定，新充值追加在
 * 末尾时 latest 永远不变，成功判定无法命中。按 Time 取最大值则与顺序无关。
 */
function latestRecordKey(list: RechargeRecord[]): string | null {
  if (list.length === 0) return null;
  let latest = list[0];
  for (const r of list) {
    if (Number(r.Time) > Number(latest.Time)) latest = r;
  }
  return recordKey(latest);
}

async function waitForTransactionReceipt(
  provider: EIP1193Provider,
  txHash: string,
  timeoutMs: number
): Promise<unknown> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    try {
      const receipt = await provider.request({
        method: "eth_getTransactionReceipt",
        params: [txHash],
      });

      if (receipt && typeof receipt === "object") {
        // MetaMask 返回 0x0，web3auth 返回 viem 格式 reverted，都视为回滚
        const status = String(
          (receipt as { status?: string }).status ?? ""
        ).toLowerCase();
        console.log("[RechargeStore] main chain receipt", {
          txHash,
          status,
          receipt,
        });
        if (status === "reverted" || status === "0x0" || status === "0") {
          throw new Error("recharge.mainChainFailed");
        }
        return receipt;
      }
    } catch (err) {
      const isNotFound =
        err instanceof Error &&
        (err.name === "TransactionReceiptNotFoundError" ||
          err.message.includes(
            "The Transaction may not be processed on a block yet"
          ));
      if (!isNotFound) {
        throw err;
      }
    }
  }
  console.error("[RechargeStore] main chain receipt timeout", {
    txHash,
    timeoutMs,
  });
  throw new Error("recharge.timeoutMainChain");
}

export const useRechargeStore = create<RechargeState>()((set, get) => ({
  status: "idle",
  history: [],
  error: null,
  userAddress: null,
  mainChainTxHash: null,
  _baseline: 0,
  _baselineLatest: null,
  _generation: 0,
  _intervalTimer: null,
  _timeoutTimer: null,

  _clearTimers: () => {
    const state = get();
    if (state._intervalTimer) {
      clearInterval(state._intervalTimer);
    }
    if (state._timeoutTimer) {
      clearTimeout(state._timeoutTimer);
    }
    set({ _intervalTimer: null, _timeoutTimer: null });
  },

  _fetchHistory: async () => {
    const { userAddress, _baselineLatest, _clearTimers, _generation } = get();
    if (!userAddress) return;
    try {
      const list = await GatewayContractApi.getRechargeHistory(
        userAddress,
        0,
        100
      );
      // await 后校验代际：dismiss/重新 startPolling 后本次结果已过期，丢弃
      if (get()._generation !== _generation) return;
      set({ history: list });
      // 成功判定：最新一条记录（按 Time 取最大，不依赖接口顺序）的 Time+Amount 与基线快照不同
      // （而非比较数组长度，避免 limit=100 截断或基线请求晚于入账导致长度不变而误报超时）
      const latest = latestRecordKey(list);
      if (latest !== null && latest !== _baselineLatest) {
        set({ status: "success", error: null, _baselineLatest: latest });
        _clearTimers();
      }
    } catch (err) {
      // await 后校验代际：dismiss/重新 startPolling 后本次失败已过期，
      // 不把旧请求的 RPC 错误写进新一轮（否则已关闭的横幅会弹出过期错误）
      if (get()._generation !== _generation) return;
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
    }
  },

  startPolling: (userAddress, provider, txHash) => {
    const state = get();
    state._clearTimers();

    const isNewUser = state.userAddress !== userAddress;
    const generation = state._generation + 1;

    set({
      status: "pending",
      error: null,
      userAddress,
      mainChainTxHash: txHash ?? null,
      history: isNewUser ? [] : state.history,
      _baseline: isNewUser ? 0 : state.history.length,
      _baselineLatest: isNewUser ? null : latestRecordKey(state.history),
      _generation: generation,
    });

    // Fetch the current history immediately to establish a reliable baseline.
    void (async () => {
      try {
        const list = await GatewayContractApi.getRechargeHistory(
          userAddress,
          0,
          100
        );
        // await 后校验代际：若期间 startPolling/dismiss 又被调用，本次已过期，丢弃
        if (get()._generation !== generation) return;

        const currentBaseline = list.length;
        // 基线「最新记录」与 _fetchHistory 的判定口径一致：按 Time 取最大值（不依赖接口顺序）
        const baselineLatest = latestRecordKey(list);
        set({
          history: list,
          _baseline: currentBaseline,
          _baselineLatest: baselineLatest,
        });

        // Start polling for a new entry.
        const intervalTimer = setInterval(() => {
          void get()._fetchHistory();
        }, POLL_INTERVAL);

        const timeoutTimer = setTimeout(() => {
          const { status: currentStatus, _clearTimers: clear, _generation: gen } = get();
          if (gen !== generation) return;
          clear();
          if (currentStatus === "pending") {
            set({ status: "idle", error: "recharge.timeoutTeeChain" });
          }
        }, POLL_TIMEOUT);

        set({ _intervalTimer: intervalTimer, _timeoutTimer: timeoutTimer });

        // Optional: also watch the main-chain receipt so we can fail early.
        if (provider && txHash) {
          void (async () => {
            try {
              await new Promise((resolve) => setTimeout(resolve, 3000));
              if (get()._generation !== generation) return;

              const receipt = await waitForTransactionReceipt(
                provider,
                txHash,
                MAIN_CHAIN_CONFIRMATION_TIMEOUT
              );
              if (get()._generation !== generation) return;

              const receiptStatus = (
                receipt as { status?: string | number | boolean }
              ).status;
              if (receiptStatus == null) return;
            } catch (err) {
              if (get()._generation !== generation) return;
              console.log(err);
              const msg =
                err instanceof Error ? err.message : "recharge.mainChainFailed";
              // 仅主链明确回滚才终止 TEE 轮询；receipt 等待超时（3min < TEE 5min）
              // 或 RPC 网络异常都不应否定可能已成功的 TEE 入账——只停止监听主链，
              // 保持 pending 继续等 TEE 侧结果（由 5min 超时兑底）。
              if (msg === "recharge.mainChainFailed") {
                const { status: currentStatus, _clearTimers: clear } = get();
                if (currentStatus === "pending") {
                  clear();
                  set({ status: "idle", error: msg });
                }
              }
            }
          })();
        }
      } catch (err) {
        if (get()._generation !== generation) return;
        const msg = err instanceof Error ? err.message : String(err);
        set({ status: "idle", error: msg });
        state._clearTimers();
      }
    })();
  },

  dismiss: () => {
    // 先自增代际使所有在途异步任务（基线请求 / 主链监听）作废，
    // 再清定时器——否则 dismiss 后基线请求恢复仍会 setInterval 继续后台轮询
    const gen = get()._generation + 1;
    get()._clearTimers();
    set({ status: "idle", error: null, _generation: gen });
  },
}));
