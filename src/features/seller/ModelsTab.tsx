import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/ui/button";
import { SectionLabel, StateBlock } from "@/ui/kit";
import { GatewayContractApi } from "@/contracts/tee/gateway";
import { useWeb3Wallet } from "@/shared/hooks/useWeb3Wallet";
import { useShop } from "@/hooks/useShops";
import { ModelRow } from "@/features/model/ModelRow";
import { AddModelModal } from "@/features/model/AddModelModal";
import { EditModelModal } from "@/features/model/EditModelModal";
import { ModelApiKeyModal } from "@/features/model/ModelApiKeyModal";
import { ModelDetailModal } from "@/pages/ModelDetailModal";
import { toast } from "@/shared/lib/toast";

/** 算力商品 tab — 模型列表（启停 / 体验 / 详情）+ 添加模型（二次 modal） */
export function ModelsTab({ id }: { id: number }) {
  const wallet = useWeb3Wallet();
  const queryClient = useQueryClient();
  const { data } = useShop(id);
  // 卖家后台：店主本人的全部模型（含已停用），在售优先、新上架在前
  const models = useMemo(() => {
    const list = data?.models ?? [];
    return [...list].sort((a, b) => {
      if (a.Data.IsActive !== b.Data.IsActive)
        return a.Data.IsActive ? -1 : 1;
      return Number(b.ID) - Number(a.ID);
    });
  }, [data]);
  const [busy, setBusy] = useState<number | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [apiKeyModelId, setApiKeyId] = useState<number | null>(null);
  const editModel = editId != null ? models.find((m) => Number(m.ID) === editId)?.Data : undefined;
  const apiKeyModel = apiKeyModelId != null ? models.find((m) => Number(m.ID) === apiKeyModelId)?.Data : undefined;
  const { t } = useTranslation();

  const toggle = async (modelID: number) => {
    const m = models.find((x) => Number(x.ID) === modelID);
    if (!m || !wallet) return;
    setBusy(modelID);
    try {
      if (m.Data.IsActive) {
        await GatewayContractApi.deactivateModel(wallet, modelID);
        toast.success(t("minishop.seller.stopped", "已停用"));
      } else {
        await GatewayContractApi.activeModel(wallet, modelID);
        toast.success(t("minishop.seller.started", "已启用"));
      }
      await queryClient.invalidateQueries({
        queryKey: ["minishop", "shop", id],
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("minishop.common.action_failed", "操作失败"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        {/*<SectionLabel index="01" title={t("minishop.shop.products", "算力商品")} count={models.length} />*/}
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="size-4" /> {t("minishop.seller.publish_product", "发布算力商品")}
        </Button>
      </div>
      <div className="mt-4">
        {models.length === 0 ? (
          <StateBlock
            title={t("minishop.seller.no_products", "还没有算力商品")}
            desc={t("minishop.seller.no_products_desc", "把你的端点挂上链，开始出售算力。")}
          >
            <Button size="sm" onClick={() => setAddOpen(true)}>
              {t("minishop.seller.publish_first", "发布第一个算力商品")}
            </Button>
          </StateBlock>
        ) : (
          <div className="border border-white/10">
            {models.map((m, i) => (
              <ModelRow
                key={m.ID}
                id={Number(m.ID)}
                model={m.Data}
                last={i === models.length - 1}
                owner={{ doing: busy === Number(m.ID), onToggle: toggle }}
                onDetail={setDetailId}
                onEdit={setEditId}
                onApiKey={setApiKeyId}
              />
            ))}
          </div>
        )}
      </div>
      <ModelDetailModal
        open={detailId != null}
        onOpenChange={(o) => {
          if (!o) setDetailId(null);
        }}
        id={detailId ?? undefined}
      />
      <AddModelModal open={addOpen} onOpenChange={setAddOpen} id={id} />
      <EditModelModal
        open={editId != null}
        onOpenChange={(o) => {
          if (!o) setEditId(null);
        }}
        model={editModel}
        id={editId ?? undefined}
      />
      <ModelApiKeyModal
        open={apiKeyModelId != null}
        onOpenChange={(o) => {
          if (!o) setApiKeyId(null);
        }}
        model={apiKeyModel}
        id={apiKeyModelId ?? undefined}
      />
    </div>
  );
}
