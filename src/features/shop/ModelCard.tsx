import { ArrowUpRight } from "lucide-react";
import type { ModelInfoV2 } from "@/hooks/useShops";
import { Button } from "@/ui/button";
import { ModelIcon } from "@/ui/ModelIcon";
import {
  modalityLabel,
  modelTypeLabel,
  ctxLabel,
  discountPct,
  parseModelMeta,
} from "@/lib/model";
import { formatCredits } from "@/shared/utils";
import { useChatContext } from "@/features/chat/chatContext";
import { useTranslation } from "react-i18next";

/** 店铺页右栏 — 算力商品卡片 */
export function ModelCard({
  model,
  id,
  onDetail,
  providerName,
}: {
  model: ModelInfoV2;
  id: number;
  onDetail: (id: number) => void;
  providerName?: string | null;
}) {
  const { openChat } = useChatContext();
  const { t } = useTranslation();
  // 折扣：优先按输入价对比原价；无输入原价则用输出价；均无原价则不显示
  const meta = parseModelMeta(model.Meta);
  const discount =
    discountPct(model.InPrice, meta.listInPrice) ??
    discountPct(model.OutPrice, meta.listOutPrice);
  return (
    <div className="flex flex-col border border-white/10 bg-white/[0.02] p-5 transition-colors hover:border-white/25 hover:bg-white/[0.04]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <ModelIcon name={model.Name} className="size-16 text-lg" />
          <div className="min-w-0">
            <div
              className={
                "truncate text-sm font-medium " +
                (model.IsActive ? "text-white" : "text-white/40")
              }
            >
              {model.Name}
            </div>
            <div className="num mt-1 text-[11px] text-white/35">
              {modalityLabel(model.InputModalities)} · ctx{" "}
              {ctxLabel(model.ContextLength)} · {modelTypeLabel(model.ModelType)}
            </div>
          </div>
        </div>
        {!model.IsActive ? (
          <span className="shrink-0 border border-white/10 px-1.5 py-0.5 text-[10px] text-white/35">
            {t("minishop.model.disabled", "已停用")}
          </span>
        ) : null}
      </div>

      {/* 标签行（价格 + 折扣徽标）独占整行，避免与按钮同行时被挤得换行 */}
      <div className="mt-4 border-t border-white/10 pt-4">
        <div className="flex items-center gap-2">
          <div className="micro-label">{t("minishop.model.price_per_m", "价格 · $/M")}</div>
          {discount != null ? (
            <span className="num shrink-0 whitespace-nowrap border border-white bg-white px-1.5 text-[10px] font-medium leading-4 text-black">
              {t("minishop.model.discount", "折扣 {{pct}}%", {
                pct: Math.round(discount),
              })}
            </span>
          ) : null}
        </div>
        <div className="mt-1.5 flex items-end justify-between gap-3">
          <div className="num min-w-0 truncate text-base text-white">
            ${formatCredits(model.InPrice)}
            <span className="mx-1 text-white/30">/</span>
            ${formatCredits(model.OutPrice)}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {model.IsActive ? (
              <Button
                size="xs"
                variant="ghost"
                onClick={() => openChat(model, providerName)}
              >
                {t("minishop.model.try", "体验")}
                <ArrowUpRight className="size-3" />
              </Button>
            ) : null}
            <Button size="xs" variant="outline" onClick={() => onDetail(id)}>
              {t("minishop.model.detail", "详情")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
