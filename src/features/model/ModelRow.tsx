import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import type { ModelInfoV2 } from "@/hooks/useShops";
import { Button } from "@/ui/button";
import { ModelIcon } from "@/ui/ModelIcon";
import {
  modalityLabel,
  modelTypeLabel,
  ctxLabel,
  firstEndpoint,
} from "@/lib/model";
import { formatCredits } from "@/shared/utils";
import { useTranslation } from "react-i18next";

/**
 * 模型密集行 — 卖家后台（ModelsTab）复用。
 * owner 提供时显示启停操作；onDetail 提供时详情走回调（modal），否则跳页面。
 */
export function ModelRow({
  model,
  id,
  last,
  owner,
  onDetail,
  onEdit,
  onApiKey,
}: {
  model: ModelInfoV2;
  id: number;
  last?: boolean;
  owner?: {
    doing: boolean;
    onToggle: (id: number) => void;
  };
  onDetail?: (id: number) => void;
  onEdit?: (id: number) => void;
  onApiKey?: (id: number) => void;
}) {
  const endpoint = firstEndpoint(model);
  const { t } = useTranslation();
  return (
    <div
      className={
        "flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-white/[0.03] sm:flex-row sm:items-center sm:justify-between sm:px-5" +
        (last ? "" : " border-b border-white/10")
      }
    >
      <div className="flex min-w-0 items-center gap-3">
        <ModelIcon name={model.Name} className="size-12 text-sm" />
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span
              className={
                "truncate text-sm font-medium " +
                (model.IsActive ? "text-white" : "text-white/40")
              }
            >
              {model.Name}
            </span>
            {!model.IsActive ? (
              <span className="shrink-0 border border-white/10 px-1.5 py-0.5 text-[10px] text-white/35">
                {t("minishop.model.disabled", "已停用")}
              </span>
            ) : null}
          </div>
          <div className="num mt-1.5 text-[11px] text-white/35">
            {modalityLabel(model.InputModalities)} · ctx{" "}
            {ctxLabel(model.ContextLength)} · {modelTypeLabel(model.ModelType)}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
        <span className="num text-[13px] text-white/80">
          ${formatCredits(model.InPrice)} / ${formatCredits(model.OutPrice)}
          <span className="text-[10px] text-white/30"> {t("minishop.model.per_m", "$/M")}</span>
        </span>
        {owner ? (
          <Button
            size="xs"
            variant={model.IsActive ? "outline" : "ghost"}
            disabled={owner.doing}
            onClick={() => owner.onToggle(id)}
          >
            {model.IsActive ? t("minishop.model.disable", "停用") : t("minishop.model.enable", "启用")}
          </Button>
        ) : null}
        {onEdit ? (
          <Button size="xs" variant="outline" onClick={() => onEdit(id)} disabled={owner?.doing}>
            {t("minishop.model.edit", "修改")}
          </Button>
        ) : null}
        {onApiKey ? (
          <Button size="xs" variant="outline" onClick={() => onApiKey(id)} disabled={owner?.doing}>
            {t("minishop.model.api_key_manage", "管理 API Key")}
          </Button>
        ) : null}
        {endpoint ? (
          <Button
            size="xs"
            variant="ghost"
            onClick={() =>
              window.open(endpoint, "_blank", "noopener noreferrer")
            }
          >
            {t("minishop.model.try", "体验")}
            <ArrowUpRight className="size-3" />
          </Button>
        ) : null}
        {onDetail ? (
          <Button size="xs" variant="outline" onClick={() => onDetail(id)}>
            {t("minishop.model.detail", "详情")}
          </Button>
        ) : (
          <Link to={`models/${id}`} className="flex">
            <Button size="xs" variant="outline">{t("minishop.model.detail", "详情")}</Button>
          </Link>
        )}
      </div>
    </div>
  );
}
