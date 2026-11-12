import { toast as sonnerToast } from "sonner";

export type ToastVariant = "default" | "success" | "error" | "info" | "warning";

export type ToastItem = {
  id: string;
  title?: string;
  description: string;
  variant?: ToastVariant;
  durationMs?: number;
};

/** Sonner toast API — supports toast.success/info/warning/error/promise */
export const toast = sonnerToast;

/** Backward-compatible wrapper around sonner for legacy pushToast callers. */
const variantTitleClasses: Record<ToastVariant, string> = {
  default: "",
  success: "!text-green-300",
  error: "!text-red-300",
  info: "!text-blue-300",
  warning: "!text-yellow-300",
};

export function pushToast(input: Omit<ToastItem, "id">): string {
  const { title, description, variant = "default", durationMs } = input;
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const titleClass = variantTitleClasses[variant];
  const options = {
    description,
    id,
    icon: null,
    classNames: titleClass ? { title: titleClass } : undefined,
    ...(durationMs !== undefined && { duration: durationMs }),
  };

  switch (variant) {
    case "success":
      sonnerToast.success(title ?? description, options);
      break;
    case "error":
      sonnerToast.error(title ?? description, options);
      break;
    case "info":
      sonnerToast.info(title ?? description, options);
      break;
    case "warning":
      sonnerToast.warning(title ?? description, options);
      break;
    default:
      sonnerToast(title ?? description, options);
      break;
  }
  return id;
}

/** @deprecated No longer needed with sonner. Kept for type compatibility. */
export function subscribeToasts() {
  return () => {
    /* no-op */
  };
}
