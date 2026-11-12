"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { XIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import {
  EXIT_ANIMATION,
  SPRING,
  STACK_BASE_Z,
  depthTransform,
  depthVisual,
  useModalStack,
} from "@/ui/modalStack";

type DialogContextValue = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const DialogContext = React.createContext<DialogContextValue | undefined>(
  undefined,
);

// modal id 递增序列（每个 DialogContent 实例唯一）
let dialogSeq = 0;

function useDialog() {
  const context = React.useContext(DialogContext);
  if (!context) {
    throw new Error("Dialog components must be used inside <Dialog>");
  }
  return context;
}

function Dialog({
  open: openProp,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;

  const handleOpenChange = React.useCallback(
    (value: boolean) => {
      onOpenChange?.(value);
      if (!isControlled) {
        setInternalOpen(value);
      }
    },
    [onOpenChange, isControlled],
  );

  return (
    <DialogContext.Provider value={{ open, onOpenChange: handleOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
}

function DialogTrigger({ children, ...props }: React.ComponentProps<"button">) {
  const { onOpenChange } = useDialog();
  return (
    <button
      type="button"
      data-slot="dialog-trigger"
      onClick={() => onOpenChange(true)}
      {...props}
    >
      {children}
    </button>
  );
}

function DialogPortal({ children }: { children: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

function DialogClose({ children, ...props }: React.ComponentProps<"button">) {
  const { onOpenChange } = useDialog();
  return (
    <button
      type="button"
      data-slot="dialog-close"
      onClick={() => onOpenChange(false)}
      {...props}
    >
      {children}
    </button>
  );
}

function DialogOverlay({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-overlay"
      data-state="open"
      className={cn(
        "fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm",
        className,
      )}
      {...props}
    />
  );
}

/* ── DialogContent：入栈 + 居中自渲染卡片 ─────────────────────────
 * 打开时入栈（store 记录顺序），关闭时先标「关闭中」做淡出，再定时出栈。
 * 卡片居中显示；后打开的叠在前面上方（z-index），更深层的卡片缩小 + 磨砂
 * （降低透明度 + 模糊），关闭最上层时下一层从中心「弹」回全尺寸（spring）。
 */
function DialogContent({
  title,
  eyebrow,
  showCloseButton = true,
  children,
  className,
}: {
  showCloseButton?: boolean;
  /** 完整标题栏：eyebrow + 标题 + hairline 分隔 + 内置关闭按钮，内容区独立滚动 */
  title?: string;
  eyebrow?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { open, onOpenChange } = useDialog();

  const idRef = React.useRef(`dlg-${++dialogSeq}`);
  const cardRef = React.useRef<HTMLDivElement | null>(null);

  const entries = useModalStack((s) => s.entries);
  const register = useModalStack((s) => s.register);
  const setClosing = useModalStack((s) => s.setClosing);
  const unregister = useModalStack((s) => s.unregister);
  const closeTimer = React.useRef<number | null>(null);

  const id = idRef.current;
  const index = entries.findIndex((e) => e.id === id);
  const entry = entries.find((e) => e.id === id);
  const depth = index === -1 ? 0 : entries.length - 1 - index;
  const zIndex = STACK_BASE_Z + Math.max(index, 0);
  const previousActive = React.useRef<Element | null>(null);
  const closing = entry?.closing ?? false;

  /* 入栈 / 出栈（带淡出延时）；关闭后把焦点交回触发元素
   * 只在实际打开时才入栈，关闭状态绝不入栈，避免“只显示遮罩、内容不显示”。 */
  React.useEffect(() => {
    if (open) {
      if (closeTimer.current) {
        clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
      register(id, onOpenChange);
      setClosing(id, false);
    } else if (index !== -1) {
      // 已入栈：先标「关闭中」淡出，再定时出栈
      setClosing(id, true);
      closeTimer.current = window.setTimeout(() => {
        unregister(id);
        closeTimer.current = null;
        const prev = previousActive.current;
        if (prev instanceof HTMLElement) prev.focus();
      }, EXIT_ANIMATION);
    }
    return () => {
      if (closeTimer.current) {
        clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
    };
  }, [open, id, index, onOpenChange, register, setClosing, unregister]);

  // 打开时记录当前焦点（触发元素），供关闭时归还
  React.useEffect(() => {
    if (open) previousActive.current = document.activeElement;
  }, [open]);

  // 卡片真正挂载后才聚焦（依赖 index 而非 open：open 变 true 时卡片尚未挂载）
  React.useLayoutEffect(() => {
    if (index === -1 || !cardRef.current) return;
    const el = cardRef.current.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    (el ?? cardRef.current).focus();
  }, [index]);

  if (index === -1) return null;

  const hasTitle = title != null;
  const visual = depthVisual(depth);
  // 磨砂只作用于「本体」：有标题时只模糊内容区（标题栏保持清晰）；无标题的卡片整体即本体
  const bodyFilter = visual.filter;
  const cardFilter = !hasTitle ? bodyFilter : undefined;
  const cardStyle: React.CSSProperties = {
    ...depthTransform(depth),
    transition: `transform 320ms ${SPRING}, opacity 280ms ease-in-out${cardFilter ? ", filter 280ms ease-in-out" : ""}`,
    opacity: closing ? 0 : (visual.opacity ?? 1),
  };
  if (cardFilter) cardStyle.filter = cardFilter;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4 sm:p-6"
      style={{ zIndex, pointerEvents: "none" }}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        data-slot="dialog-card"
        data-state={closing ? "closed" : "open"}
        className={cn(
          "relative w-full max-w-5xl mx-auto pointer-events-auto rounded-none border border-white/15 bg-black shadow-[0_30px_60px_-20px_rgba(0,0,0,0.65)]",
          hasTitle
            ? "flex max-h-[85vh] flex-col"
            : "grid gap-2 p-6",
          className,
        )}
        style={cardStyle}
      >
        {hasTitle ? (
          <>
            {/* 标题栏 — 固定不滚动，内容区在下方独立滚动 */}
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 px-5 py-3.5 sm:px-6">
              <div className="min-w-0">
                {eyebrow ? (
                  <div className="micro-label leading-none">{eyebrow}</div>
                ) : null}
                <h2
                  className={cn(
                    "truncate text-[15px] font-semibold leading-tight tracking-tight text-white",
                    eyebrow && "mt-1.5",
                  )}
                >
                  {title}
                </h2>
              </div>
              {showCloseButton ? (
                <button
                  type="button"
                  data-slot="dialog-close"
                  className="flex size-8 shrink-0 items-center justify-center border border-white/20 text-white/60 transition-colors hover:border-white/50 hover:bg-white/5 hover:text-white"
                  onClick={() => onOpenChange(false)}
                >
                  <XIcon className="size-4" />
                  <span className="sr-only">Close</span>
                </button>
              ) : null}
            </div>
            {/* 内容区 — 独立滚动；背景层时仅此处磨砂（标题栏保持清晰） */}
            <div
              className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6"
              style={bodyFilter ? { filter: bodyFilter, transition: "filter 280ms ease-in-out" } : undefined}
            >
              {children}
            </div>
          </>
        ) : (
          <>
            {children}
            {showCloseButton ? (
              <button
                type="button"
                data-slot="dialog-close"
                className="absolute top-4 right-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-subtle"
                onClick={() => onOpenChange(false)}
              >
                <XIcon className="size-4" />
                <span className="sr-only">Close</span>
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="dialog-description"
      className={cn("text-sm text-subtle", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
