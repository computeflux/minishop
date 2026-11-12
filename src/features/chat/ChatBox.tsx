import { useEffect, useRef } from "react";
import {
  Send,
  Square,
  X,
  MessageSquare,
  Loader2,
  RotateCw,
} from "lucide-react";
import { Button } from "@/ui/button";
import { ModelIcon } from "@/ui/ModelIcon";
import { useTranslation } from "react-i18next";
import { useWeb3Auth, useWeb3AuthConnect } from "@wetee/web3auth/react";
import { cn } from "@/shared/lib/utils";
import { useChatSession } from "./useChatSession";
import type { ModelInfoV2 } from "@/hooks/useShops";

/**
 * 悬浮聊天框主体。
 * - 未连接钱包：展示连接 CTAs（与 RechargeModal 一致的体验）
 * - 已连接：消息流 + 输入框 + 停止 / 重置
 */
export function ChatBox({
  model,
  providerName,
  onClose,
}: {
  model: ModelInfoV2;
  providerName?: string | null;
  onClose: () => void;
}) {
  const { isConnected } = useWeb3Auth();
  const { connect, loading } = useWeb3AuthConnect();
  const { t } = useTranslation();
  const { messages, input, setInput, loading: busy, send, reset } =
    useChatSession(model, providerName);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, busy]);

  // 输入框随内容自适应高度
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [input]);

  const submit = () => {
    if (!busy && input.trim()) send();
  };

  const keydown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  if (!isConnected) {
    return (
      <div
        className="flex h-[28rem] w-80 shrink-0 flex-col overflow-hidden border border-white/15 bg-black sm:w-96"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <ModelIcon name={model.Name} className="size-10 shrink-0" />
            <div className="min-w-0">
              <div className="micro-label leading-none">{t("minishop.chat.chat_header", "Chat · 体验")}</div>
              <div className="mt-1 truncate text-[13px] font-medium text-white">
                {model.Name}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-7 shrink-0 items-center justify-center border border-white/20 text-white/60 hover:border-white/50 hover:bg-white/5 hover:text-white"
          >
            <X className="size-3.5" />
          </button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <MessageSquare className="size-6 text-white/30" />
          <p className="text-[13px] leading-relaxed text-white/50">
            {t("minishop.chat.connect_hint", "连接钱包后即可与该模型对话，费用从积分余额按量结算。")}
          </p>
          <Button size="sm" onClick={connect} disabled={loading}>
            {loading ? t("minishop.chat.connecting", "连接中…") : t("minishop.chat.connect_wallet", "连接钱包")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[28rem] w-80 shrink-0 flex-col overflow-hidden border border-white/15 bg-black sm:w-96">
      {/* header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <ModelIcon name={model.Name} className="size-10 shrink-0" />
          <div className="min-w-0">
            <div className="micro-label leading-none">{t("minishop.chat.chat_header", "Chat · 体验")}</div>
            <div className="mt-1 truncate text-[13px] font-medium text-white">
              {model.Name}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={reset}
            aria-label="重置对话"
            title={t("minishop.chat.reset", "重置对话")}
            className="flex size-7 items-center justify-center border border-white/20 text-white/60 transition-colors hover:border-white/50 hover:bg-white/5 hover:text-white"
          >
            <RotateCw className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-7 items-center justify-center border border-white/20 text-white/60 transition-colors hover:border-white/50 hover:bg-white/5 hover:text-white"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {/* messages */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <p className="text-[13px] text-white/40">{t("minishop.chat.greeting", "向该模型打个招呼吧")}</p>
            <span className="text-[11px] text-white/25">
              {t("minishop.chat.session_saved", "对话仅保存在当前窗口")}
            </span>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex gap-2",
                m.role === "user" ? "self-end" : "self-start"
              )}
            >
              {m.role === "assistant" ? (
                <ModelIcon name={model.Name} className="size-6 shrink-0" />
              ) : null}
              <div
                className={cn(
                  "whitespace-pre-wrap break-words rounded px-3 py-2 text-[13px] leading-relaxed",
                  m.role === "user"
                    ? "bg-white text-black"
                    : "border border-white/10 text-white/85"
                )}
              >
                {m.content || (busy ? "…" : "")}
              </div>
            </div>
          ))
        )}
        {busy && messages.length > 0 ? (
          <div className="flex items-center gap-1.5 self-start text-white/40">
            <Loader2 className="size-3.5 animate-spin" />
            <span className="text-[11px]">{t("minishop.chat.generating", "生成中")}</span>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {/* input */}
      <div className="flex items-end gap-2 border-t border-white/10 px-3 py-3">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={keydown}
          placeholder={t("minishop.chat.placeholder", "给该模型发一条消息…")}
          rows={1}
          className="max-h-24 min-h-8 flex-1 resize-none bg-transparent text-sm text-white outline-none placeholder:text-white/30"
        />
        <Button
          size="icon-sm"
          onClick={submit}
          disabled={!input.trim() && !busy}
          title={!input.trim() && !busy ? "" : busy ? t("minishop.chat.stop", "停止") : t("minishop.chat.send", "发送")}
        >
          {busy ? (
            <Square className="size-3.5" />
          ) : (
            <Send className="size-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}
