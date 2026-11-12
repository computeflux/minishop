import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Store } from "lucide-react";
import { Dialog, DialogContent } from "@/ui/dialog";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Textarea } from "@/ui/textarea";
import { Field } from "@/ui/form";
import { GatewayContractApi } from "@/contracts/tee/gateway";
import { useWeb3Wallet } from "@/shared/hooks/useWeb3Wallet";
import { toast } from "@/shared/lib/toast";
import { useTranslation } from "react-i18next";
import type { ProviderInfo } from "@/contracts/tee/types/gateway";

/**
 * 区域枚举映射 — 与 lib/model.ts 的 regionLabel 完全一致（全局唯一来源）：
 * 0/1=全球、2=北美、3=欧洲、4=亚洲、5=大洋洲、6=中东、7=非洲。
 * value→i18n key 定义在模块级（t 在组件内才可用，标签在组件内解析）。
 */
const regionKeyByValue: Record<number, string> = {
  0: "minishop.common.region_global",
  1: "minishop.common.region_global",
  2: "minishop.common.region_na",
  3: "minishop.common.region_eu",
  4: "minishop.common.region_asia",
  5: "minishop.common.region_oc",
  6: "minishop.common.region_me",
  7: "minishop.common.region_af",
};

/** 与 regionKeyByValue 同序的中文兜底文案（i18n 缺失时回退）。 */
const regionCnByValue: Record<number, string> = {
  0: "全球",
  1: "全球",
  2: "北美",
  3: "欧洲",
  4: "亚洲",
  5: "大洋洲",
  6: "中东",
  7: "非洲",
};

/**
 * 编辑店铺信息（上链）— 卖家后台「店铺概览」编辑入口。
 * 表单字段对应链上 updateProvider：
 * name / logoURL / description / modelIds / region / feeRate / priority / uptimeSLA。
 * 链上 updateProvider 不改 Owner，故店主地址只读展示。
 */
export function ShopEditModal({
  open,
  onOpenChange,
  provider,
  id,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: ProviderInfo | undefined;
  id: number | undefined;
}) {
  const wallet = useWeb3Wallet();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  // 区域下拉：复用 lib/model 的全局唯一映射，标签在组件内用 t 解析
  const regionOptions = useMemo(
    () =>
      Object.keys(regionKeyByValue).map((v) => {
        const value = Number(v);
        return { value, label: t(regionKeyByValue[value], regionCnByValue[value]) };
      }),
    [t]
  );

  const [name, setName] = useState("");
  const [logoURL, setLogoURL] = useState("");
  const [description, setDescription] = useState("");
  const [modelIds, setModelIds] = useState("");
  const [region, setRegion] = useState(0);
  const [feeRate, setFeeRate] = useState("0");
  const [priority, setPriority] = useState("0");
  const [uptimeSLA, setUptimeSLA] = useState("0");
  const [busy, setBusy] = useState(false);

  // 打开时用当前店铺数据填充表单
  useEffect(() => {
    if (!open || !provider) return;
    setName(provider.Name ?? "");
    setLogoURL(provider.LogoURL ?? "");
    setDescription(provider.Description ?? "");
    setModelIds((provider.ModelIds ?? []).join(", "));
    setRegion(provider.Region ?? 0);
    setFeeRate(String(provider.FeeRate ?? 0));
    setPriority(String(provider.Priority ?? 0));
    setUptimeSLA(String(provider.UptimeSLA ?? 0));
  }, [open, provider]);

  const submit = async () => {
    if (!provider || !wallet) return toast.error(t("minishop.common.connect_first", "请先连接钱包"));
    if (!name.trim()) return toast.error(t("minishop.seller.fill_shop_name", "请填写店铺名称"));
    setBusy(true);
    try {
      toast.info(t("minishop.seller.updating", "正在更新店铺信息（上链）…"));
      const modelIdsNum = modelIds
        .split(/[\n,;\s]+/)
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 0);
      const feeRateNum = Number(feeRate);
      const priorityNum = Number(priority);
      const uptimeSLANum = Number(uptimeSLA);
      await GatewayContractApi.updateProvider(
        wallet,
        Number(id),
        name.trim(),
        logoURL.trim(),
        description.trim(),
        modelIdsNum,
        region,
        feeRateNum,
        priorityNum,
        uptimeSLANum
      );
      toast.success(t("minishop.seller.updated", "店铺信息已更新！"));
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
        title={t("minishop.seller.edit_title", "编辑店铺")}
        eyebrow={t("minishop.seller.edit_eyebrow", "Shop · 编辑店铺信息")}
      >
        <Field label={t("minishop.seller.shop_name", "店铺名称")} required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label={t("minishop.seller.shop_logo", "店铺 Logo URL（选填）")}>
          <Input
            placeholder="https://"
            value={logoURL}
            onChange={(e) => setLogoURL(e.target.value)}
          />
        </Field>
        <Field label={t("minishop.seller.shop_description", "店铺介绍")}>
          <Textarea
            placeholder={t("minishop.seller.shop_description_placeholder", "介绍一下你的店铺与提供的算力…")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <Field label={t("minishop.seller.shop_models", "模型 ID（选填，逗号分隔）")}>
          <Input
            placeholder={t("minishop.seller.shop_models_placeholder", "1, 2, 3")}
            value={modelIds}
            onChange={(e) => setModelIds(e.target.value)}
          />
        </Field>
        <Field label={t("minishop.seller.region", "区域")}>
          <select
            value={region}
            onChange={(e) => setRegion(Number(e.target.value))}
            className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white/85 outline-none focus:border-white/30"
          >
            {regionOptions.map((o) => (
              <option key={o.value} value={o.value} className="bg-neutral-900">
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("minishop.seller.fee_rate", "手续费 %")}>
            <Input
              type="number"
              value={feeRate}
              onChange={(e) => setFeeRate(e.target.value)}
            />
          </Field>
          <Field label={t("minishop.seller.priority", "优先级")}>
            <Input
              type="number"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            />
          </Field>
          <Field label={t("minishop.seller.uptime_sla", "可用性 SLA %")}>
            <Input
              type="number"
              value={uptimeSLA}
              onChange={(e) => setUptimeSLA(e.target.value)}
            />
          </Field>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("minishop.common.cancel", "取消")}
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Store className="size-4" />
            )}
            {t("minishop.seller.edit_onchain", "更新店铺信息（上链）")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
