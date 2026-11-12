import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent } from "@/ui/dialog";
import { ModelDetailPanel } from "@/features/model/ModelDetailPanel";

/** 模型详情弹窗 — 店铺页商品卡片与卖家后台商品行共用 */
export function ModelDetailModal({
  open,
  onOpenChange,
  id,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  id: number | undefined;
}) {
  // 保留最近一次打开的 id，关闭动画期间内容不闪空
  const [heldId, setHeldId] = useState<number | undefined>(id);
  const { t } = useTranslation();
  useEffect(() => {
    if (id != null) setHeldId(id);
  }, [id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={t("minishop.model.detail_title", "模型详情")}
        eyebrow={t("minishop.model.detail_eyebrow", "Model · 算力商品")}
      >
        <ModelDetailPanel id={heldId} statsCols={3} />
      </DialogContent>
    </Dialog>
  );
}
