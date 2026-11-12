import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Server } from "lucide-react";
import { Dialog, DialogContent } from "@/ui/dialog";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Textarea } from "@/ui/textarea";
import { Field, ChipGroup } from "@/ui/form";
import { GatewayContractApi } from "@/contracts/tee/gateway";
import { useWeb3Wallet } from "@/shared/hooks/useWeb3Wallet";
import { toast } from "@/shared/lib/toast";
import { useTranslation } from "react-i18next";
import type { ModelInfoV2 } from "@/hooks/useShops";
import { formatPoints, parseModelMeta, parseUris } from "@/lib/model";

/**
 * 修改模型（上链）— 二次 modal，由 ModelRow「修改」触发。
 * 表单与添加模型一致（含 meta：原价 / 模型介绍 / 排序权重）。
 * 链上 updateModel 不可改名称、不改 API Key，
 * 故商品名称仅只读展示，API Key 不在此编辑（走独立 refactor）。
 */
export function EditModelModal({
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

  const modalityOptions = [
    { value: 0x01, label: t("minishop.model.modality_text", "文本") },
    { value: 0x02, label: t("minishop.model.modality_image", "图像") },
    { value: 0x04, label: t("minishop.model.modality_audio", "音频") },
    { value: 0x08, label: t("minishop.model.modality_video", "视频") },
  ];

  const [modelName, setModelName] = useState("");
  const [modalities, setModalities] = useState<number[]>([0x01]);
  const [contextLength, setContextLength] = useState("128000");
  const [inPrice, setInPrice] = useState("0.3");
  const [cachedPrice, setCachedPrice] = useState("0.15");
  const [outPrice, setOutPrice] = useState("1.2");
  const [uris, setUris] = useState("https://api.openai.com/v1");
  const [maxConcurrency, setMaxConcurrency] = useState("10");
  const [listInPrice, setListInPrice] = useState("");
  const [listCachedPrice, setListCachedPrice] = useState("");
  const [listOutPrice, setListOutPrice] = useState("");
  const [description, setDescription] = useState("");
  const [sortWeight, setSortWeight] = useState("");
  const [callers, setCallers] = useState("");
  const [busy, setBusy] = useState(false);

  // 打开时用当前模型数据填充表单
  useEffect(() => {
    if (!open || !model) return;
    setModelName(model.Name ?? "");
    const bits: number[] = [];
    for (const v of [0x01, 0x02, 0x04, 0x08]) if (model.InputModalities & v) bits.push(v);
    setModalities(bits.length ? bits : [0x01]);
    setContextLength(String(model.ContextLength ?? "128000"));
    setInPrice(formatPoints(model.InPrice));
    setCachedPrice(formatPoints(model.CachedPrice));
    setOutPrice(formatPoints(model.OutPrice));
    const uriValues = Object.values(parseUris(model.URIS));
    setUris(uriValues[0] ?? "");
    setMaxConcurrency(String(model.MaxConcurrency ?? 10));
    // meta（可选字段）：未存过时为空
    const meta = parseModelMeta(model.Meta);
    setListInPrice(meta.listInPrice != null ? String(meta.listInPrice) : "");
    setListCachedPrice(meta.listCachedPrice != null ? String(meta.listCachedPrice) : "");
    setListOutPrice(meta.listOutPrice != null ? String(meta.listOutPrice) : "");
    setDescription(meta.description ?? "");
    setSortWeight(meta.sortWeight != null ? String(meta.sortWeight) : "");
    setCallers((meta.callers ?? []).join("\n"));
  }, [open, model]);

  const submit = async () => {
    if (!model) return;
    if (!wallet) return toast.error(t("minishop.common.connect_first", "请先连接钱包"));
    if (!uris.trim()) return toast.error(t("minishop.model.fill_model_fields", "请填写端点 URL"));
    setBusy(true);
    try {
      toast.info(t("minishop.model.publishing", "正在修改算力商品（上链）…"));
      const inputModalities = modalities.reduce((a, b) => a | b, 0);
      // 自定义 meta：原价（输入/缓存/输出）/ 模型介绍 / 排序权重 — 均可选，未填则省略；链上 meta 整体替换
      const meta: Record<string, unknown> = {};
      const listInPriceNum = Number(listInPrice);
      if (listInPrice.trim() !== "" && Number.isFinite(listInPriceNum)) meta.listInPrice = listInPriceNum;
      const listCachedPriceNum = Number(listCachedPrice);
      if (listCachedPrice.trim() !== "" && Number.isFinite(listCachedPriceNum)) meta.listCachedPrice = listCachedPriceNum;
      const listOutPriceNum = Number(listOutPrice);
      if (listOutPrice.trim() !== "" && Number.isFinite(listOutPriceNum)) meta.listOutPrice = listOutPriceNum;
      const sortWeightNum = Number(sortWeight);
      if (sortWeight.trim() !== "" && Number.isFinite(sortWeightNum)) meta.sortWeight = sortWeightNum;
      if (description.trim()) meta.description = description.trim();
      const callerList = callers
        .split(/[\n,;\s]+/)
        .map((s) => s.trim())
        .filter((s) => s !== "");
      if (callerList.length > 0) meta.callers = callerList;
      const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : "";
      await GatewayContractApi.updateModel(
        wallet,
        Number(id),
        inputModalities,
        Number(contextLength) || 0,
        Math.round((Number(inPrice) || 0) * 1e6),
        Math.round((Number(cachedPrice) || 0) * 1e6),
        Math.round((Number(outPrice) || 0) * 1e6),
        model.ModelType,
        JSON.stringify({ "1": uris.trim() }),
        Number(maxConcurrency) || 10,
        String(model.Balance),
        model.Thinking ?? false,
        metaStr
      );
      toast.success(t("minishop.model.published", "算力商品已修改！"));
      await queryClient.invalidateQueries({
        queryKey: ["minishop", "shop", id],
      });
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("minishop.common.action_failed", "操作失败"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={busy ? () => undefined : onOpenChange}>
      <DialogContent
        title={t("minishop.model.edit_title", "修改模型")}
        eyebrow={t("minishop.model.edit_eyebrow", "Model · 修改算力商品")}
      >
        <Field label={t("minishop.model.product_name", "商品名称")} required>
          <Input
            value={modelName}
            readOnly
            className="opacity-70"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("minishop.model.description_label", "模型介绍（选填）")}>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <Field label={t("minishop.model.sort_weight_label", "排序权重（选填）")}>
            <Input
              type="number"
              value={sortWeight}
              onChange={(e) => setSortWeight(e.target.value)}
            />
          </Field>
        </div>
        <Field label={t("minishop.model.callers_label", "调用者白名单（选填，每行一个地址）")}>
          <Textarea
            placeholder={t("minishop.model.callers_placeholder", "0x…（留空 = 不限制）")}
            value={callers}
            onChange={(e) => setCallers(e.target.value)}
          />
        </Field>
        <Field label={t("minishop.model.modality", "模态")}>
          <ChipGroup
            options={modalityOptions}
            value={modalities}
            onChange={(v) => setModalities(v as number[])}
            multi
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("minishop.model.context_length", "上下文长度")}>
            <Input
              type="number"
              value={contextLength}
              onChange={(e) => setContextLength(e.target.value)}
            />
          </Field>
          <Field label={t("minishop.model.max_concurrency", "最大并发")}>
            <Input
              type="number"
              value={maxConcurrency}
              onChange={(e) => setMaxConcurrency(e.target.value)}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("minishop.model.in_price_label", "输入价格 $/M")}>
            <Input
              type="number"
              value={inPrice}
              onChange={(e) => setInPrice(e.target.value)}
            />
          </Field>
          <Field label={t("minishop.model.cached_price_label", "缓存价格 $/M")}>
            <Input
              type="number"
              value={cachedPrice}
              onChange={(e) => setCachedPrice(e.target.value)}
            />
          </Field>
          <Field label={t("minishop.model.out_price_label", "输出价格 $/M")}>
            <Input
              type="number"
              value={outPrice}
              onChange={(e) => setOutPrice(e.target.value)}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("minishop.model.list_in_price_label", "输入原价 $/M（选填）")}>
            <Input
              type="number"
              value={listInPrice}
              onChange={(e) => setListInPrice(e.target.value)}
            />
          </Field>
          <Field label={t("minishop.model.list_cached_price_label", "缓存原价 $/M（选填）")}>
            <Input
              type="number"
              value={listCachedPrice}
              onChange={(e) => setListCachedPrice(e.target.value)}
            />
          </Field>
          <Field label={t("minishop.model.list_out_price_label", "输出原价 $/M（选填）")}>
            <Input
              type="number"
              value={listOutPrice}
              onChange={(e) => setListOutPrice(e.target.value)}
            />
          </Field>
        </div>
        <Field label={t("minishop.model.endpoint_url", "端点 URL")} required>
          <Input
            placeholder="https://api.example.com/v1"
            value={uris}
            onChange={(e) => setUris(e.target.value)}
          />
        </Field>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("minishop.common.cancel", "取消")}
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Server className="size-4" />
            )}
            {t("minishop.model.edit_onchain", "修改算力商品（上链）")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
