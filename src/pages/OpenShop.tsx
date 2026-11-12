import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Store, Server, Loader2, Check } from "lucide-react";
import { useWeb3Auth, useWeb3AuthConnect } from "@wetee/web3auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { useWeb3Wallet } from "@/shared/hooks/useWeb3Wallet";
import { GatewayContractApi } from "@/contracts/tee/gateway";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Textarea } from "@/ui/textarea";
import { MicroLabel, Display, SectionLabel } from "@/ui/kit";
import { Field, ChipGroup } from "@/ui/form";
import { useMyProvider } from "@/hooks/useShops";
import { toast } from "@/shared/lib/toast";
import { cn } from "@/shared/lib/utils";
import { useTranslation } from "react-i18next";

export default function OpenShop() {
  const { address, isConnected } = useWeb3Auth();
  const { connect, loading } = useWeb3AuthConnect();
  const { data: myProviderRaw, isLoading: provLoading } = useMyProvider(
    address ?? undefined
  );
  const existingId = myProviderRaw
    ? Number(String(myProviderRaw).replace(/,/g, ""))
    : null;

  const [step, setStep] = useState<1 | 2>(1);

  // A wallet that already has a shop skips straight to publishing.
  useEffect(() => {
    if (isConnected && existingId) setStep(2);
  }, [isConnected, existingId]);

  // Step 1: shop info
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [region, setRegion] = useState(1);

  // Step 2: model
  const [modelName, setModelName] = useState("");
  const [modalities, setModalities] = useState<number[]>([0x01]);
  const [contextLength, setContextLength] = useState("128000");
  const [inPrice, setInPrice] = useState("0.3");
  const [cachedPrice, setCachedPrice] = useState("0.15");
  const [outPrice, setOutPrice] = useState("1.2");
  const [uris, setUris] = useState("https://api.openai.com/v1");
  const [apiKey, setApiKey] = useState("");
  const [maxConcurrency, setMaxConcurrency] = useState("10");

  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  const wallet = useWeb3Wallet();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const modalityOptions = [
    { value: 0x01, label: t("minishop.model.modality_text", "文本") },
    { value: 0x02, label: t("minishop.model.modality_image", "图像") },
    { value: 0x04, label: t("minishop.model.modality_audio", "音频") },
    { value: 0x08, label: t("minishop.model.modality_video", "视频") },
  ];
  const regionOptions = [
    { value: 1, label: t("minishop.open.region_global", "全球") },
    { value: 2, label: t("minishop.open.region_north_america", "北美") },
    { value: 3, label: t("minishop.open.region_europe", "欧洲") },
    { value: 4, label: t("minishop.open.region_asia", "亚洲") },
  ];

  const createProvider = async () => {
    if (!wallet) return toast.error(t("minishop.common.connect_first", "请先连接钱包"));
    if (!name.trim()) return toast.error(t("minishop.open.fill_shop_name", "请填写店铺名称"));
    setBusy(true);
    try {
      toast.info(t("minishop.open.creating_shop", "正在创建店铺（上链）…"));
      await GatewayContractApi.createProvider(
        wallet,
        name.trim(),
        "",
        description.trim(),
        region,
        0
      );
      // pick up the new shop id for the header / step 2 note
      void queryClient.invalidateQueries({ queryKey: ["minishop", "myProvider"] });
      toast.success(t("minishop.open.shop_created", "店铺已创建，请填写算力商品"));
      setStep(2);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("minishop.open.create_failed", "创建失败"));
    } finally {
      setBusy(false);
    }
  };

  const register = async () => {
    if (!wallet) return toast.error(t("minishop.common.connect_first", "请先连接钱包"));
    if (!modelName.trim() || !uris.trim() || !apiKey.trim())
      return toast.error(t("minishop.model.fill_model_fields", "请填写商品名称、端点 URL 和 API Key"));
    setBusy(true);
    try {
      toast.info(t("minishop.model.publishing", "正在发布算力商品（上链）…"));
      const inputModalities = modalities.reduce((a, b) => a | b, 0);
      await GatewayContractApi.registerModel(
        wallet,
        modelName.trim(),
        inputModalities,
        Number(contextLength) || 0,
        Math.round((Number(inPrice) || 0) * 1e6),
        Math.round((Number(cachedPrice) || 0) * 1e6),
        Math.round((Number(outPrice) || 0) * 1e6),
        2, // commercial
        JSON.stringify({ "1": uris.trim() }),
        [apiKey.trim()],
        Number(maxConcurrency) || 10,
        "0",
        false,
        ""
      );
      const pid = await GatewayContractApi.getProviderByOwner(wallet.address);
      const num = Number(String(pid).replace(/,/g, ""));
      setDone(Number.isFinite(num) && num > 0 ? num : existingId ?? 0);
      toast.success(t("minishop.model.published", "算力商品已发布！"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("minishop.model.publish_failed", "发布失败"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <MicroLabel>{t("minishop.open.eyebrow", "Open Shop · 开设小铺")}</MicroLabel>
      <Display className="mt-4 text-2xl sm:text-3xl">
        {step === 1 ? t("minishop.open.h1_1", "先开店，") : t("minishop.open.h2_1", "再上架，")}
        <span className="text-white/40">
          {step === 1 ? t("minishop.open.h1_2", "再上架算力。") : t("minishop.open.h2_2", "开张营业。")}
        </span>
      </Display>

      {/* Steps */}
      <div className="mt-8 flex items-center gap-3">
        <StepMarker n="01" label={t("minishop.open.step1_label", "店铺信息")} state={step > 1 ? "done" : "active"} />
        <div
          className={cn(
            "h-px flex-1",
            step > 1 ? "bg-white/60" : "bg-white/15"
          )}
        />
        <StepMarker n="02" label={t("minishop.open.step2_label", "发布算力")} state={step === 2 ? "active" : "idle"} />
      </div>

      <div className="mt-6">
        {!isConnected ? (
          <div className="border border-white/10 p-8 text-center">
            <p className="text-sm text-white/60">
              {t("minishop.open.connect_hint", "开设店铺需要链上签名，请先连接钱包。")}
            </p>
            <div className="mt-5 flex justify-center">
              <Button onClick={connect} disabled={loading}>
                {loading ? t("minishop.common.connecting", "连接中…") : t("minishop.common.connect", "连接钱包")}
              </Button>
            </div>
          </div>
        ) : done != null ? (
          <SuccessBlock shopId={done} />
        ) : step === 1 ? (
          <Panel>
            <SectionLabel index="01" title={t("minishop.open.step1_label", "店铺信息")} />
            <p className="mt-3 text-[13px] leading-relaxed text-white/45">
              {t("minishop.open.shop_info_desc", "店铺注册到链上后，任何人通过链接即可进入你的私域消费算力。")}
            </p>
            <div className="mt-6">
              <Field label={t("minishop.open.shop_name", "店铺名称")} required>
                <Input
                  placeholder="e.g. my-compute-shop"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field label={t("minishop.open.description", "介绍")}>
                <Textarea
                  placeholder={t("minishop.open.desc_placeholder", "简要描述你的算力服务…")}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>
              <Field label={t("minishop.open.region", "区域")}>
                <ChipGroup
                  options={regionOptions}
                  value={region}
                  onChange={(v) => setRegion(v as number)}
                />
              </Field>
            </div>
            <div className="mt-8 flex justify-end">
              <Button onClick={createProvider} disabled={busy}>
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Store className="size-4" />
                )}
                {t("minishop.open.create_shop", "创建店铺（上链）")}
              </Button>
            </div>
          </Panel>
        ) : (
          <Panel>
            <SectionLabel index="02" title={t("minishop.open.publish_product", "发布算力商品")} />
            <p className="mt-3 text-[13px] leading-relaxed text-white/45">
              {existingId
                ? t("minishop.open.has_id", { id: existingId, defaultValue: "店铺 ID {{id}} · 商品将挂到你的店铺下" })
                : provLoading
                ? t("minishop.open.creating_shop_loading", "店铺创建中…")
                : t("minishop.open.fill_endpoint_price", "填写端点与价格，商品即刻上架。")}
            </p>
            <div className="mt-6">
              <Field label={t("minishop.model.product_name", "商品名称")} required>
                <Input
                  placeholder="e.g. gpt-mini"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
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
              <div className="grid gap-5 sm:grid-cols-3">
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
                <Field label={t("minishop.open.model_type", "模型类型")}>
                  <Input value="Commercial" disabled />
                </Field>
              </div>
              <div className="grid gap-5 sm:grid-cols-3">
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
              <Field label={t("minishop.model.endpoint_url", "端点 URL")} required>
                <Input
                  placeholder="https://api.example.com/v1"
                  value={uris}
                  onChange={(e) => setUris(e.target.value)}
                />
              </Field>
              <Field label="API Key" required>
                <Input
                  type="password"
                  placeholder="sk-…"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </Field>
            </div>
            <div className="mt-8 flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep(1)}
                disabled={busy}
              >
                {t("minishop.open.prev_step", "上一步")}
              </Button>
              <Button onClick={register} disabled={busy}>
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Server className="size-4" />
                )}
                {t("minishop.model.publish_onchain", "发布算力（上链）")}
              </Button>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}

/* ── pieces ───────────────────────────────────────────────────────────── */

function SuccessBlock({ shopId }: { shopId: number }) {
  const { t } = useTranslation();
  return (
    <div className="border border-white/10 p-8 text-center">
      <div className="mx-auto flex size-10 items-center justify-center border border-white/20">
        <Check className="size-5" />
      </div>
      <div className="mt-5 text-base font-medium text-white">{t("minishop.open.shop_open", "店铺已开张")}</div>
      <p className="mt-2 text-[13px] text-white/45">
        {t("minishop.open.share_hint", "把店铺链接分享到你的私域，买家进来即可消费。")}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link to={`/${shopId}`}>
          <Button size="sm" variant="outline">{t("minishop.open.view_shop", "查看店铺")}</Button>
        </Link>
        <Link to="/my-shop">
          <Button size="sm">{t("minishop.shop.manage", "管理店铺")}</Button>
        </Link>
      </div>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="border border-white/10 p-6 sm:p-8">{children}</div>;
}

function StepMarker({
  n,
  label,
  state,
}: {
  n: string;
  label: string;
  state: "done" | "active" | "idle";
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "num flex size-6 items-center justify-center border text-[10px]",
          state === "done" && "bg-white text-black border-white",
          state === "active" && "border-white text-white",
          state === "idle" && "border-white/15 text-white/30"
        )}
      >
        {state === "done" ? "✓" : n}
      </span>
      <span
        className={cn(
          "text-xs",
          state === "idle" ? "text-white/30" : "text-white/80"
        )}
      >
        {label}
      </span>
    </div>
  );
}


