import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Copy, Play, ExternalLink, BookOpen, ShieldCheck } from "lucide-react";
import { useModel } from "@/hooks/useShops";
import { Button } from "@/ui/button";
import { MessageSquare } from "lucide-react";
import {
  MicroLabel,
  Display,
  StatusChip,
  StatsGrid,
  SectionLabel,
  UsageModal,
  StateBlock,
} from "@/ui/kit";
import {
  API_FORMAT_LABEL,
  modalityLabel,
  modelTypeLabel,
  parseUris,
  ctxLabel,
} from "@/lib/model";
import { copyText, formatCredits } from "@/shared/utils";
import { useTranslation } from "react-i18next";
import { ModelIcon } from "@/ui/ModelIcon";
import { useChatContext } from "@/features/chat/chatContext";
import { ModelQuickStart } from "@/features/model/ModelQuickStart";

/** 模型详情主体 — /models/:id 页面与"详情"弹窗共用 */
export function ModelDetailPanel({
  id,
  statsCols = 6,
}: {
  id: number | undefined;
  statsCols?: 3 | 6;
}) {
  const { data, isLoading, isError } = useModel(id);
  const { openChat } = useChatContext();
  const { t } = useTranslation();
  const [quickOpen, setQuickOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);

  if (id == null) return null;
  if (isLoading)
    return <StateBlock state="loading" title={t("minishop.model.reading", "正在读取模型…")} />;
  if (isError || !data)
    return (
      <StateBlock state="error" title={t("minishop.model.not_found", "模型不存在或加载失败。")}>
        <Link to="/">
          <Button size="sm" variant="outline">{t("minishop.common.back_home", "返回首页")}</Button>
        </Link>
      </StateBlock>
    );

  const { model, provider } = data;
  const uris = parseUris(model.URIS);
  const endpointList = Object.entries(uris);

  return (
    <>
      {/* Identity */}
      <section className="border border-white/10 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <MicroLabel>{t("minishop.model.id_label", "Model · ID")} {id}</MicroLabel>
            <div className="mt-3 mb-4 flex flex-wrap items-center gap-4">
              <ModelIcon name={model.Name} className="size-12 text-base" />
              <div className="flex flex-wrap items-center gap-3">
                <Display className="text-2xl sm:text-4xl">{model.Name}</Display>
                <StatusChip active={model.IsActive} activeText={t("minishop.model.running", "运行中")} />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {model.IsActive ? (
                <>
                  <Button
                    size="sm"
                    onClick={() => openChat(model, provider?.Name ?? null)}
                  >
                    <MessageSquare className="size-4" /> {t("minishop.model.try_chat", "体验对话")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setQuickOpen(true)}
                  >
                    <Play className="size-4" /> Quick Start
                  </Button>
                </>
              ) : null}
              <Button size="sm" variant="outline" asChild>
                <a
                  href="https://test.computeflux.ai/docs/setup"
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink className="size-4" /> {t("minishop.model.docs", "文档")}
                </a>
              </Button>
            </div>
          </div>
        </div>

        {model.Thinking ? (
          <div className="mt-5 inline-flex border border-white/15 px-2 py-1 text-[11px] text-white/60">
            {t("minishop.model.thinking", "支持推理 · Thinking")}
          </div>
        ) : null}
      </section>

      {/* Spec */}
      <StatsGrid
        className="mt-3"
        cols={statsCols}
        items={[
          { label: t("minishop.model.context", "上下文"), value: ctxLabel(model.ContextLength) },
          {
            label: t("minishop.model.in_price", "输入价格"),
            value: `$${formatCredits(model.InPrice)}`,
            sub: t("minishop.model.per_m_tokens", "per 1M tokens"),
          },
          {
            label: t("minishop.model.cached_price", "缓存价格"),
            value: `$${formatCredits(model.CachedPrice)}`,
            sub: t("minishop.model.per_m_tokens", "per 1M tokens"),
          },
          {
            label: t("minishop.model.out_price", "输出价格"),
            value: `$${formatCredits(model.OutPrice)}`,
            sub: t("minishop.model.per_m_tokens", "per 1M tokens"),
          },
          { label: t("minishop.model.max_concurrency", "最大并发"), value: String(model.MaxConcurrency) },
          {
            label: t("minishop.model.type", "类型"),
            value: modelTypeLabel(model.ModelType),
            sub: modalityLabel(model.InputModalities),
          },
        ]}
      />

      {/* Endpoints */}
      <div className="mt-12">
        <SectionLabel
          index="01"
          title={t("minishop.model.endpoints", "调用端点 · Endpoints")}
          count={endpointList.length}
        />
        <div className="mt-1 flex items-start gap-2 text-[11px] leading-relaxed text-white/50">
          <ShieldCheck className="size-3.5 shrink-0 mt-0.5 text-white/40" />
          <span>
            {t("minishop.model.tee_note", "请求将由去中心化网络中的 TEE（可信执行环境）完成调用。全程 TEE 保护，你的提示词与返回数据不会以明文泄漏。")}
          </span>
        </div>
        <div className="mt-4">
          {endpointList.length === 0 ? (
            <StateBlock title={t("minishop.model.no_endpoint_title", "无端点信息")} desc={t("minishop.model.no_endpoint_desc", "店主尚未配置调用端点。")} />
          ) : (
            <div className="border border-white/10">
              {endpointList.map(([fmt, url], i) => (
                <div
                  key={url}
                  className={
                    "flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5" +
                    (i < endpointList.length - 1 ? " border-b border-white/10" : "")
                  }
                >
                  <div className="min-w-0">
                    <div className="font-mono text-[11px] uppercase tracking-widest text-white/30">
                      {API_FORMAT_LABEL[Number(fmt)] ?? "API"}
                    </div>
                    <code className="num mt-1 block truncate text-[13px] text-white/85">
                      {url}
                    </code>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ModelQuickStart
        open={quickOpen}
        onOpenChange={setQuickOpen}
        model={model}
        providerName={provider?.Name ?? null}
      />
      <UsageModal open={usageOpen} onOpenChange={setUsageOpen} />
    </>
  );
}
