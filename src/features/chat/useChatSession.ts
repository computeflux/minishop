import { useCallback, useRef, useState } from "react";
import i18n from "@/i18n";
import { getTeeProviderBase } from "@/shared/config/api";
import type { ModelInfoV2 } from "@/hooks/useShops";

/** 一条聊天记录。 */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

/** web3auth 持久化 session 的 localStorage key（与 tokenManager 一致） */
const AUTH_STORAGE_KEY = "web3auth:session";

/** 从 localStorage 读取会话 token；无则返回 null。 */
function readAuthToken(): string | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as { token?: string };
    return session?.token ?? null;
  } catch {
    return null;
  }
}

/**
 * 由当前模型推导传给统一后端的 model 标识。
 * 与 dapp 一致：`${providerName}/${modelName}`；缺 provider 时回退 model.Name。
 */
export function resolveModelId(
  model: ModelInfoV2,
  providerName?: string | null
): string {
  if (providerName && providerName.trim()) {
    return `${providerName.trim()}/${model.Name}`;
  }
  return model.Name;
}

let msgSeq = 0;
function newId() {
  msgSeq += 1;
  return `${Date.now().toString(36)}-${msgSeq}`;
}

/**
 * 解析统一后端返回的业务错误体 {error:{message,type}}，映射为友好的中文提示。
 * 未接入上游客流的模型会返回 type=invalid_request（客户端无法构建请求），
 * 这类错误属于后端数据问题，向用户提示「更换模型」而非暴露原始报文。
 */
function parseBackendError(body: string, status: number): string {
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return status ? i18n.t("minishop.chat.request_failed_http", `请求失败（HTTP ${status}）`) : i18n.t("minishop.chat.request_failed", "请求失败");
  }
  const e = (raw as { error?: { message?: string; type?: string } } | null)
    ?.error;
  if (e?.type === "auth_error") {
    return i18n.t("minishop.chat.session_expired", "会话已失效，请重新连接钱包后再试");
  }
  if (e?.type === "invalid_request") {
    const msg = e.message ?? "";
    if (msg.includes("model must be"))
      return i18n.t("minishop.chat.model_id_format", "模型标识格式错误（应为 模型名/标识）");
    return i18n.t("minishop.chat.model_unavailable", "该模型暂不可用，请更换其他模型体验");
  }
  if (e?.message) return e.message;
  return status ? i18n.t("minishop.chat.request_failed_http", `请求失败（HTTP ${status}）`) : i18n.t("minishop.chat.request_failed", "请求失败");
}

interface Session {
  messages: ChatMessage[];
  input: string;
  setInput: (v: string) => void;
  loading: boolean;
  error: string | null;
  send: (text?: string) => void;
  stop: () => void;
  reset: () => void;
}

/**
 * 与「当前模型」单次对话的会话 hook。
 * - 走统一 tee-provider 后端的 `/v1/chat/completions`（OpenAI 兼容，SSE 流式）
 * - 使用 web3auth 会话 token 作为 Bearer 鉴权
 * - 支持停止生成 / 清空记录
 */
export function useChatSession(
  model: ModelInfoV2 | null,
  providerName?: string | null
): Session {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const controllerRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  const apiBase = getTeeProviderBase();
  const completionsUrl = apiBase ? `${apiBase}/v1/chat/completions` : "";
  const modelId = model ? resolveModelId(model, providerName) : "";

  /** 追加一条消息 */
  const push = useCallback((m: ChatMessage) => {
    setMessages((prev) => [...prev, m]);
  }, []);

  /** 更新最后一条消息（流式补全、错误提示都写它） */
  const patchLast = useCallback((patch: Partial<ChatMessage>) => {
    setMessages((prev) => {
      if (!prev.length) return prev;
      const next = [...prev];
      next[next.length - 1] = { ...next[next.length - 1], ...patch };
      return next;
    });
  }, []);

  const send = useCallback(
    async (rawText?: string) => {
      const content = (rawText ?? input).trim();
      if (!content || loading) return;
      setError(null);

      const token = readAuthToken();
      if (!token) {
        setError(i18n.t("minishop.chat.connect_first_chat", "请先连接钱包后再聊天"));
        return;
      }
      if (!completionsUrl || !modelId) {
        setError(i18n.t("minishop.chat.not_configured", "未配置后端地址或模型标识，暂时无法体验"));
        return;
      }

      setLoading(true);
      push({ id: newId(), role: "user", content });
      push({ id: newId(), role: "assistant", content: "" });

      const controller = new AbortController();
      controllerRef.current = controller;

      // 带上话术历史的请求（停止时历史不写入，仅本次会话）
      const history = messagesRef.current.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      history.push({ role: "user", content });

      let acc = "";
      try {
        const response = await fetch(completionsUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            model: modelId,
            messages: history,
            stream: true,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => "");
          throw new Error(parseBackendError(errText, response.status));
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("无响应体");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === "data: [DONE]" || !trimmed.startsWith("data: "))
              continue;
            try {
              const chunk = JSON.parse(trimmed.slice(6)) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const delta = chunk.choices?.[0]?.delta?.content;
              if (delta) {
                acc += delta;
                patchLast({ content: acc });
              }
            } catch {
              /* 忽略畸形 chunk */
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // 停止：保留已生成的部分内容
          if (acc) patchLast({ content: acc });
          return;
        }
        const msg = err instanceof Error ? err.message : i18n.t("minishop.chat.request_failed", "请求失败");
        patchLast({ content: acc ? `${acc}\n\n${i18n.t("minishop.chat.error_prefix", "出错了：")}${msg}` : `${i18n.t("minishop.chat.error_prefix", "出错了：")}${msg}` });
        setError(msg);
      } finally {
        setLoading(false);
        controllerRef.current = null;
      }
    },
    [input, loading, completionsUrl, modelId, push, patchLast]
  );

  const stop = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    setMessages([]);
    setInput("");
    setError(null);
  }, []);

  return { messages, input, setInput, loading, error, send, stop, reset };
}
