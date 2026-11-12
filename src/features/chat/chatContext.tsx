import { createContext, useCallback, useContext, useState } from "react";
import type { ModelInfoV2 } from "@/hooks/useShops";

/**
 * 全局「体验对话」状态。
 * 聊天框是悬浮的、模型级的——从任意模型表面（店铺卡片、模型详情）
 * 触发 openChat(model)，全局 ChatWidget 弹出悬浮聊天框。
 */
export interface ChatContextValue {
  open: boolean;
  model: ModelInfoV2 | null;
  providerName: string | null;
  /** 以「当前模型」发起悬浮对话；providerName 用于拼写统一后端的 model 标识 */
  openChat: (model: ModelInfoV2, providerName?: string | null) => void;
  closeChat: () => void;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [model, setModel] = useState<ModelInfoV2 | null>(null);
  const [providerName, setProviderName] = useState<string | null>(null);

  const openChat = useCallback(
    (m: ModelInfoV2, pn?: string | null) => {
      setModel(m);
      setProviderName(pn ?? null);
      setOpen(true);
    },
    []
  );

  const closeChat = useCallback(() => setOpen(false), []);

  return (
    <ChatContext.Provider
      value={{ open, model, providerName, openChat, closeChat }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error("useChatContext must be used within <ChatProvider>");
  }
  return ctx;
}
