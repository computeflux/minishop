import { createContext, useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  KeyRound,
  Plus,
  Search,
  Copy,
  Check,
  Eye,
  EyeOff,
  Globe,
  Wallet,
  RefreshCw,
} from "lucide-react";
import { Dialog, DialogContent } from "@/ui/dialog";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { MicroLabel, Display, StateBlock } from "@/ui/kit";
import { getTeeProviderBase } from "@/shared/config/api";
import { copyText } from "@/shared/utils";
import { useWeb3Auth, useWeb3AuthConnect } from "@wetee/web3auth/react";
import { useApiKeys } from "./useApiKeys";
import { shortHash, formatDate } from "./utils";

/* ── 全局 modal 状态（参考 recharge，跨所有入口可达）────────────── */
type ApiKeysCtx = {
  open: boolean;
  setOpen: (open: boolean) => void;
  openApiKeys: () => void;
};

const Ctx = createContext<ApiKeysCtx>({
  open: false,
  setOpen: () => {},
  openApiKeys: () => {},
});

export function ApiKeysProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Ctx.Provider value={{ open, setOpen, openApiKeys: () => setOpen(true) }}>
      {children}
    </Ctx.Provider>
  );
}

export function useApiKeysModal() {
  return useContext(Ctx);
}

/* ── Modal 入口 ─────────────────────────────────────────────────────── */

export function ApiKeysModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { isConnected } = useWeb3Auth();
  const { connect, loading } = useWeb3AuthConnect();
  const api = useApiKeys();
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        eyebrow="API Keys"
        title={t("dashboard.api_keys.title", "API Key 管理")}
        className="flex max-h-[85vh]"
      >
        {!isConnected ? (
          <div className="flex flex-col items-center gap-4 px-4 py-10 text-center">
            <KeyRound className="size-8 text-white/20" />
            <p className="text-[13px] text-white/50">
              管理 API Key 需先连接钱包。
            </p>
            <Button onClick={connect} disabled={loading}>
              <Wallet className="size-4" />
              {loading ? t("nav.connecting", "连接中…") : t("nav.connect", "连接钱包")}
            </Button>
          </div>
        ) : (
          <ApiKeysBody api={api} />
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── 管理主体（对应原 ApiKeys 页面内容）─────────────────────────────── */

function ApiKeysBody({ api }: { api: ReturnType<typeof useApiKeys> }) {
  const { t } = useTranslation();
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <MicroLabel>API Keys</MicroLabel>
          <Display className="mt-2 text-xl sm:text-2xl">API Key 管理</Display>
          <p className="mt-2 text-sm text-white/45">
            {t("dashboard.api_keys.subtitle", "创建密钥后，用 OpenAI 兼容端点调用任意模型的算力，费用从积分余额按量结算。")}
          </p>
        </div>
        <Button onClick={() => api.setShowCreate(true)}>
          <Plus className="size-4" /> {t("dashboard.api_keys.create_key", "新建 API Key")}
        </Button>
      </div>

      {/* 端点 */}
      <EndpointCard
        url={`${getTeeProviderBase()}/v1`}
        label="OpenAI"
        sub="Compatible"
      />

      {/* 新建表单 */}
      {api.showCreate && (
        <CreateForm
          raw={api.newKeyRaw}
          onRegenerate={api.handleRegenerate}
          rateLimit={api.rateLimit}
          onChangeRateLimit={api.setRateLimit}
          onConfirm={() => api.registerKey.mutate()}
          onCancel={api.resetCreate}
          busy={api.registerKey.isPending}
        />
      )}

      {/* 搜索 + 显示已吊销 */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-white/30" />
          <Input
            type="text"
            placeholder="按密钥或哈希搜索…"
            value={api.search}
            onChange={(e) => api.setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => api.setShowInactive(!api.showInactive)}
          className={
            "shrink-0 text-[13px] " +
            (api.showInactive
              ? "border border-white/20 bg-white/5 text-white"
              : "text-white/50 hover:text-white")
          }
        >
          {api.showInactive ? (
            <Eye className="size-3.5" />
          ) : (
            <EyeOff className="size-3.5" />
          )}
          {api.showInactive ? t("dashboard.api_keys.hide_revoked", "隐藏已吊销") : t("dashboard.api_keys.show_revoked", "显示已吊销")}
        </Button>
      </div>

      {/* 密钥列表 */}
      <div className="mt-3 flex flex-col gap-3">
        {api.isLoading ? (
          <StateBlock state="loading" title={t("common.loading", "正在读取密钥…")} />
        ) : api.filteredKeys.length === 0 ? (
          <EmptyState hasSearch={Boolean(api.search)} />
        ) : (
          api.filteredKeys.map((k) => (
            <KeyRow
              key={k.keyHash + k.createdAt}
              item={k}
              editingHash={api.editingHash}
              editingRateLimit={api.editingRateLimit}
              copiedHash={api.copiedHash}
              onChangeRateLimit={api.setEditingRateLimit}
              onStartEdit={(hash, limit) => api.startEdit(hash, limit)}
              onCancelEdit={api.cancelEdit}
              onSaveEdit={(hash, limit) =>
                api.updateKey.mutate({ keyHash: hash, rateLimit: limit })
              }
              onCopy={api.handleCopy}
              onRevoke={(hash) => api.revokeKey.mutate(hash)}
            />
          ))
        )}
      </div>

      {/* 刚创建的密钥 — 仅展示一次 */}
      {api.justCreated && (
        <KeyReveal
          item={api.justCreated}
          onCopy={api.handleCopy}
          copiedHash={api.copiedHash}
          onDismiss={api.dismissCreated}
        />
      )}
    </>
  );
}

/* ── 端点卡片 ─────────────────────────────────────────────────────────── */

function EndpointCard({
  label,
  sub,
  url,
}: {
  label: string;
  sub: string;
  url: string;
}) {
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation();
  const doCopy = async () => {
    await copyText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="mt-5 flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-white/15">
        <Globe className="size-4 text-white/50" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-white">{label}</span>
          <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-white/40">
            {sub}
          </span>
        </div>
        <code className="mt-1 block truncate text-[12px] font-mono text-white/55">
          {url}
        </code>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={doCopy}
        className="shrink-0 h-8 text-xs"
      >
        {copied ? (
          <>
            <Check className="size-3.5 mr-1" /> {t("dashboard.api_keys.copied", "已复制")}
          </>
        ) : (
          <>
            <Copy className="size-3.5 mr-1" /> {t("dashboard.api_keys.copy", "复制")}
          </>
        )}
      </Button>
    </div>
  );
}

/* ── 新建表单 ─────────────────────────────────────────────────────────── */

function CreateForm({
  raw,
  onRegenerate,
  rateLimit,
  onChangeRateLimit,
  onConfirm,
  onCancel,
  busy,
}: {
  raw: string;
  onRegenerate: () => void;
  rateLimit: string;
  onChangeRateLimit: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">{t("dashboard.api_keys.create_key", "新建 API Key")}</h3>
        <button
          type="button"
          onClick={onRegenerate}
          title="重新生成"
          className="flex items-center gap-1.5 text-xs text-white/50 transition-colors hover:text-white"
        >
          <RefreshCw className="size-3.5" /> 重新生成
        </button>
      </div>

      <label className="mt-3 block text-[13px] text-white/50">
        密钥（创建后仅展示一次，务必复制）
        <div className="mt-1">
          <Input
            type="text"
            value={raw}
            readOnly
            className="font-mono text-xs text-white/70"
          />
        </div>
      </label>

      <label className="mt-3 block text-[13px] text-white/50">
        {t("dashboard.api_keys.rate_limit", "速率限制（可选）")}
        <Input
          type="number"
          min="0"
          placeholder="0 = 不限制"
          value={rateLimit}
          onChange={(e) => onChangeRateLimit(e.target.value)}
          className="mt-1"
        />
      </label>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={busy}>
          {t("common.cancel", "取消")}
        </Button>
        <Button size="sm" onClick={onConfirm} disabled={busy}>
          {busy ? t("common.loading", "创建中…") : t("dashboard.api_keys.create_key", "创建")}
        </Button>
      </div>
    </div>
  );
}

/* ── 密钥行 ───────────────────────────────────────────────────────────── */

function KeyRow({
  item,
  editingHash,
  editingRateLimit,
  copiedHash,
  onChangeRateLimit,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onCopy,
  onRevoke,
}: {
  item: {
    keyHash: string;
    prefix?: string;
    rateLimit: number;
    isActive: boolean;
    createdAt: number;
  };
  editingHash: string | null;
  editingRateLimit: string;
  copiedHash: string | null;
  onChangeRateLimit: (v: string) => void;
  onStartEdit: (hash: string, limit: number) => void;
  onCancelEdit: () => void;
  onSaveEdit: (hash: string, limit: number) => void;
  onCopy: (text: string, id: string) => void;
  onRevoke: (hash: string) => void;
}) {
  const { t } = useTranslation();
  const isEditing = editingHash === item.keyHash;
  const save = () => {
    const v = Number(editingRateLimit);
    if (Number.isFinite(v) && v >= 0) onSaveEdit(item.keyHash, v);
  };
  return (
    <div
      className={
        "flex flex-wrap items-center gap-4 rounded-lg border px-4 py-3 " +
        (item.isActive
          ? "border-white/10"
          : "border-dashed border-white/10 opacity-60")
      }
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <code className="text-sm font-mono text-white/80">
            {item.prefix || shortHash(item.keyHash)}
          </code>
          <span
            className={
              "border px-1.5 py-0.5 text-[10px] " +
              (item.isActive
                ? "border-white/20 text-white/70"
                : "border-white/10 text-white/35")
            }
          >
            {item.isActive ? t("dashboard.api_keys.active", "有效") : t("dashboard.api_keys.revoked", "已吊销")}
          </span>
        </div>
        <div className="mt-1 text-[11px] text-white/35">
          {shortHash(item.keyHash)} · 速率 {item.rateLimit} ·{" "}
          {formatDate(item.createdAt)}
        </div>
      </div>

      {isEditing ? (
        <div className="flex shrink-0 items-center gap-2">
          <Input
            type="number"
            min="0"
            value={editingRateLimit}
            onChange={(e) => onChangeRateLimit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
            }}
            className="h-8 w-24 text-xs"
            autoFocus
          />
          <Button type="button" size="xs" onClick={save}>
            保存
          </Button>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={onCancelEdit}
          >
            {t("common.cancel", "取消")}
          </Button>
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => onCopy(item.keyHash, item.keyHash)}
          >
            {copiedHash === item.keyHash ? (
              <>
                <Check className="size-3.5" /> {t("dashboard.api_keys.copied", "已复制")}
              </>
            ) : (
              <>
                <Copy className="size-3.5" /> {t("dashboard.api_keys.copy", "复制")}
              </>
            )}
          </Button>
          {item.isActive ? (
            <>
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => onStartEdit(item.keyHash, item.rateLimit)}
              >
                编辑
              </Button>
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => onRevoke(item.keyHash)}
              >
                吊销
              </Button>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

/* ── 空状态 ───────────────────────────────────────────────────────────── */

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-white/10 py-12 text-center">
      <KeyRound className="size-8 text-white/20" />
      <p className="text-sm text-white/45">
        {hasSearch ? "没有匹配的密钥" : "暂无 API Key"}
      </p>
      <p className="text-xs text-white/30">
        {hasSearch ? "尝试更换搜索关键词" : "点击“新建 API Key”创建调用密钥"}
      </p>
    </div>
  );
}

/* ── 刚创建的密钥 — 仅展示一次 ─────────────────────────────────────────── */

function KeyReveal({
  item,
  onCopy,
  copiedHash,
  onDismiss,
}: {
  item: { rawKey: string; keyHash: string; rateLimit: number };
  onCopy: (text: string, id: string) => void;
  copiedHash: string | null;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="mt-6 rounded-lg border border-white/15 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-white">
            请复制此密钥，之后无法再次查看
          </h3>
          <p className="mt-1 text-xs text-white/40">{t("dashboard.api_keys.rate_limit", "速率限制")} {item.rateLimit}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="关闭"
          className="flex size-7 shrink-0 items-center justify-center border border-white/20 text-white/60 transition-colors hover:border-white/50 hover:bg-white/5 hover:text-white"
        >
          ✕
        </button>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Input
          type="text"
          value={item.rawKey}
          readOnly
          className="font-mono text-sm text-white"
        />
        <Button
          type="button"
          size="icon-sm"
          onClick={() => onCopy(item.rawKey, item.keyHash)}
          title="复制密钥"
        >
          {copiedHash === item.keyHash ? (
            <Check className="size-3.5" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}
