import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, X, Save, Pencil } from "lucide-react";
import { Dialog, DialogContent } from "@/ui/dialog";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { GatewayContractApi } from "@/contracts/tee/gateway";
import { useWeb3Wallet } from "@/shared/hooks/useWeb3Wallet";
import { toast } from "@/shared/lib/toast";
import { useTranslation } from "react-i18next";
import type { ModelInfoV2 } from "@/hooks/useShops";

/**
 * 模型 API Key 管理 — 独立 modal（增 / 行内改 / 删）。
 * 由 ModelRow「API Key」按钮触发，传入当前模型。
 * 链上存 ref（addModelApiKeyRef / updateModelApiKeyRef / deleteModelApiKeyRef），
 * 每次调用由 TEE 自动注入，明文不外泄。操作后刷新店铺查询。
 */
export function ModelApiKeyModal({
  open,
  onOpenChange,
  model,
  id,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model: ModelInfoV2 | undefined;
  id: number | undefined;
}) {
  const wallet = useWeb3Wallet();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  // 模型已绑定的 API Key 引用（链上 ref）
  const apiKeyRefs = model?.APIKeys ?? [];

  const [newKey, setNewKey] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [actionBusy, setActionBusy] = useState<"add" | "edit" | "delete" | null>(null);

  const apiRef = async (
    label: "add" | "edit" | "delete",
    fn: (k: string) => Promise<unknown>,
    val: string
  ): Promise<boolean> => {
    if (!wallet) {
      toast.error(t("minishop.common.connect_first", "请先连接钱包"));
      return false;
    }
    setActionBusy(label);
    try {
      await fn(val);
      toast.success(t("minishop.model.api_key_saved", "API Key 已保存"));
      await queryClient.invalidateQueries({ queryKey: ["minishop", "shop", id] });
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("minishop.common.action_failed", "操作失败"));
      return false;
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={actionBusy ? () => undefined : onOpenChange}>
      <DialogContent
        title={t("minishop.model.api_key_title", "管理 API Key")}
        eyebrow={t("minishop.model.api_key_eyebrow", "API Key · 算力商品")}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-medium text-white/70">
            {t("minishop.model.api_key_refs", "API Key")}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowAdd((v) => !v)}
            disabled={actionBusy !== null}
            className="h-6 px-1.5 text-[11px] text-white/50 hover:text-white"
          >
            <Plus className="size-3 mr-0.5" />
            {t("minishop.model.api_key_ref_add", "添加")}
          </Button>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-white/40">
          {t("minishop.model.api_key_refs_hint", "将上游服务的 API Key 加密存储上链，模型每次调用时由 TEE 自动注入。全程 TEE 保护，明文不外泄。")}
        </p>

        <div className="mt-3 flex flex-col gap-2">
          {apiKeyRefs.length === 0 && !showAdd ? (
            <p className="py-6 text-center text-[12px] text-white/35">
              {t("minishop.model.no_api_key", "暂无 API Key")}
            </p>
          ) : (
            apiKeyRefs.map((key, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  type="text"
                  placeholder={t("minishop.model.api_key_ref_placeholder", "API Key {{n}}", { n: idx + 1 })}
                  value={editingIdx === idx ? editingValue : key}
                  readOnly={editingIdx !== idx}
                  onChange={(e) => setEditingValue(e.target.value)}
                  className="h-7 flex-1 text-[11px] font-mono"
                />
                {editingIdx === idx ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => { setEditingIdx(null); setEditingValue(""); }}
                      disabled={actionBusy !== null}
                      title={t("minishop.common.cancel", "取消")}
                    >
                      <X className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={() =>
                        apiRef("edit", (v) => GatewayContractApi.updateModelApiKeyRef(wallet!, Number(id), idx, v), editingValue.trim()).then((ok) => {
                          if (ok) { setEditingIdx(null); setEditingValue(""); }
                        })
                      }
                      disabled={actionBusy !== null}
                      title={t("minishop.common.save", "保存")}
                    >
                      {actionBusy === "edit" ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Save className="size-3.5" />
                      )}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => { setEditingIdx(idx); setEditingValue(key); }}
                      disabled={actionBusy !== null}
                      title={t("minishop.model.edit", "修改")}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() =>
                        apiRef("delete", (v) => GatewayContractApi.deleteModelApiKeyRef(wallet!, Number(id), idx), key).then((ok) => {
                          if (ok) setEditingIdx(null);
                        })
                      }
                      disabled={actionBusy !== null}
                      title={t("minishop.model.delete", "删除")}
                    >
                      {actionBusy === "delete" ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                    </Button>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {showAdd ? (
          <div className="mt-3 flex items-center gap-2">
            <Input
              type="text"
              placeholder={t("minishop.model.api_key_ref_placeholder", "API Key {{n}}", { n: apiKeyRefs.length + 1 })}
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              className="h-7 flex-1 text-[11px]"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => { setShowAdd(false); setNewKey(""); }}
              disabled={actionBusy !== null}
              title={t("minishop.common.cancel", "取消")}
            >
              <X className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() =>
                apiRef("add", (v) => GatewayContractApi.addModelApiKeyRef(wallet!, Number(id), v), newKey).then((ok) => {
                  if (ok) { setNewKey(""); setShowAdd(false); }
                })
              }
              disabled={actionBusy !== null}
              title={t("minishop.common.save", "保存")}
            >
              {actionBusy === "add" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
