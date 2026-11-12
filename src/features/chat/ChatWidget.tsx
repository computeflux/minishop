import { createPortal } from "react-dom";
import { MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useChatContext } from "./chatContext";
import { ChatBox } from "./ChatBox";

/**
 * 全局悬浮聊天控件（挂载于 body）。
 * - 未选择模型：不渲染
 * - 已选择但未打开：右下角悬浮触发按钮
 * - 已打开：弹出悬浮聊天框（ChatBox）
 */
export function ChatWidget() {
  const { t } = useTranslation();
  const { open, model, providerName, openChat, closeChat } =
    useChatContext();
  if (!model) return null;

  return createPortal(
    <div className="fixed inset-x-0 bottom-0 z-[5000] flex justify-end px-4 pb-4">
      {open && model ? (
        <ChatBox model={model} providerName={providerName} onClose={closeChat} />
      ) : (
        <button
          type="button"
          onClick={() => openChat(model, providerName)}
          aria-label="与该模型对话"
          title={t("minishop.model.try_chat", "体验对话")}
          className="flex size-12 items-center justify-center border border-white/20 bg-black/90 text-white backdrop-blur transition-colors hover:bg-white hover:text-black"
        >
          <MessageSquare className="size-5" />
        </button>
      )}
    </div>,
    document.body
  );
}
