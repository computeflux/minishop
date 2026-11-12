import { cn } from "@/shared/lib/utils";

/** 表单字段 — label + 控件 */
export function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <label className="mb-2 flex items-center gap-1 text-xs text-white/50">
        {label}
        {required ? <span className="text-white/70">*</span> : null}
      </label>
      {children}
    </div>
  );
}

/** 选项芯片组 — 单选 / 多选 */
export function ChipGroup({
  options,
  value,
  onChange,
  multi,
}: {
  options: { value: number; label: string }[];
  value: number | number[];
  onChange: (v: number | number[]) => void;
  multi?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = multi
          ? (value as number[]).includes(o.value)
          : value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() =>
              multi
                ? onChange(
                    (value as number[]).includes(o.value)
                      ? (value as number[]).filter((b) => b !== o.value)
                      : [...(value as number[]), o.value]
                  )
                : onChange(o.value)
            }
            className={cn(
              "border px-3 py-1.5 text-[13px] transition-colors",
              active
                ? "border-white bg-white text-black"
                : "border-white/15 text-white/50 hover:border-white/40 hover:text-white"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
