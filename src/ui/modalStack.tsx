"use client";

import { useEffect, useRef, useState } from "react";
import { create } from "zustand";
import type { CSSProperties, ReactNode } from "react";

/**
 * 全局 Modal 叠层（stack）。
 *
 * 过去每个 Dialog 各自 portal + 居中，嵌套时只能靠 z-index 区分，没有视觉层级。
 * 现在所有 modal 汇入同一个栈：后打开的叠在前面上方，统一从「左下角」以卡片叠放的形式浮现，
 * 关闭最上层时，下面的卡片从左下角「弹」回原位。
 *
 * 实现：
 *   - 栈 store（zustand）持有全部入栈 modal 的顺序 + 关闭状态。
 *   - 每个 DialogContent 从 store 读出自身深度/层级，portal 出「自己」的卡片，
 *     因此每个 modal 仍是自渲染、可交互（输入框等不受影响）。
 *   - Host 只负责统一遮罩 + Escape + 滚动锁。
 *
 * 使用方式（对业务代码透明）：
 *   <Dialog open onOpenChange><DialogContent …/>— 打开时自动入栈，关闭时自动出栈。
 */

export interface StackEntry {
  id: string;
  /** 关闭当前 modal（交给业务侧的 onOpenChange） */
  onOpenChange: (open: boolean) => void;
  /** 正在关闭动画中（用于淡出） */
  closing: boolean;
}

interface ModalStackState {
  entries: StackEntry[];
  /** 入栈（id 已存在则忽略，避免重复） */
  register: (id: string, onOpenChange: (open: boolean) => void) => void;
  /** 更新关闭状态（触发动画） */
  setClosing: (id: string, closing: boolean) => void;
  /** 出栈 */
  unregister: (id: string) => void;
}

export const useModalStack = create<ModalStackState>((set) => ({
  entries: [],
  register: (id, onOpenChange) =>
    set((s) =>
      s.entries.some((e) => e.id === id)
        ? s
        : { entries: [...s.entries, { id, onOpenChange, closing: false }] },
    ),
  setClosing: (id, closing) =>
    set((s) => ({
      entries: s.entries.map((e) => (e.id === id ? { ...e, closing } : e)),
    })),
  unregister: (id) =>
    set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
}));

/* ── 卡片叠放（悬浮）几何 ─────────────────────────────────────────── */
// 顶层 depth=0（全尺寸、居中）。每更深一层向左下偏移并缩小，形成“悬浮卡片叠放”：
// 下层卡片从顶层卡片下方/侧边露出，关闭顶层时下一层弹回中心全尺寸（spring）。
export const DEEP_OFFSET_X = 44; // 每层偏移 x（加大，叠放更明显）
export const DEEP_OFFSET_Y = 30; // 每层偏移 y
export const DEEP_SCALE_STEP = 0.07; // 每层缩小比例
export const DEEP_FADE_STEP = 0.42; // 每层透明度递减（背景卡片退隐）
export const DEEP_FADE_MIN = 0.35; // 透明度下限
export const DEEP_BLUR_STEP = 1.5; // 每层模糊增量（px）— 只作用于卡片本体
export const DEEP_BLUR_MAX = 4; // 模糊上限（性能考虑）
export const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)"; // 回弹缓动
export const EXIT_ANIMATION = 260; // 出栈/淡出时长
export const STACK_BASE_Z = 1001; // 卡片基准 z-index（顶层 = baseZ + index）

/** 由「距顶层的深度」计算 transform：偏移 + 缩小（悬浮叠放效果）。 */
export function depthTransform(depth: number) {
  const scale = 1 - depth * DEEP_SCALE_STEP;
  const tx = -depth * DEEP_OFFSET_X;
  const ty = depth * DEEP_OFFSET_Y;
  return { transform: `translate(${tx}px, ${ty}px) scale(${scale})` };
}

/**
 * 背景（非顶层）卡片的视觉：透明度作用于整卡，模糊只作用于「本体」（内容区）。
 * 顶层 modal 较小时，下层卡片的内容退隐，不再抢视觉焦点；
 * 关闭顶层时随 opacity/filter 过渡一起平滑「弹」回清晰状态。
 */
export function depthVisual(depth: number): CSSProperties {
  if (depth <= 0) return {};
  const opacity = Math.max(DEEP_FADE_MIN, 1 - depth * DEEP_FADE_STEP);
  const blur = Math.min(depth * DEEP_BLUR_STEP, DEEP_BLUR_MAX);
  return { opacity, filter: `blur(${blur}px)` };
}

/* ── 背景遮罩（整层栈统一一个）───────────────────────────────────── */
function StackOverlay({ onExit }: { onExit: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);
  return (
    <div
      data-slot="stack-overlay"
      className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm transition-opacity duration-280"
      style={{ opacity: mounted ? 1 : 0 }}
      onClick={onExit}
    />
  );
}

/* ── 栈宿主：统一遮罩 + Escape + 滚动锁 ──────────────────────────── */
function StackHost() {
  const entries = useModalStack((s) => s.entries);

  // 关闭最上层（遮罩点击 / Escape）
  const exitTop = () => {
    const top = entries[entries.length - 1];
    if (top) top.onOpenChange(false);
  };

  // Escape 只关闭最上层
  useEffect(() => {
    if (entries.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const top = entries[entries.length - 1];
      if (!top) return;
      e.preventDefault();
      top.onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [entries]);

  // 顶层滚动锁：内层关闭不立即释放（与弹出节奏一致）
  const lockRef = useRef(false);
  useEffect(() => {
    if (entries.length > 0 && !lockRef.current) {
      lockRef.current = true;
      document.body.style.overflow = "hidden";
    } else if (entries.length === 0 && lockRef.current) {
      lockRef.current = false;
      document.body.style.overflow = "";
    }
  }, [entries]);

  if (entries.length === 0) return null;

  return <StackOverlay onExit={exitTop} />;
}

/* ── Provider ─────────────────────────────────────────────────────── */
export function ModalStackProvider({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <StackHost />
    </>
  );
}
