import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GatewayContractApi } from "@/contracts/tee/gateway";
import { useWeb3Wallet } from "@/shared/hooks/useWeb3Wallet";
import { toast } from "@/shared/lib/toast";
import { copyText } from "@/shared/utils";
import type { APIKeyInfoV2 } from "@/contracts/tee/types/gateway";
import {
  generateAPIKey,
  hashAPIKey,
  hexToBytes,
  nowTs,
  type ApiKeyItem,
} from "./utils";

/** 链上 KeyHash(Vec<u8>) 解码为 hex */
function bytesToHex(val: unknown): string {
  if (typeof val === "string") {
    if (val.startsWith("0x")) return val;
    return (
      "0x" +
      Array.from(val)
        .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
  }
  if (val instanceof Uint8Array) {
    return (
      "0x" +
      Array.from(val)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
    );
  }
  if (Array.isArray(val)) {
    return (
      "0x" +
      (val as number[])
        .map((b) => Number(b).toString(16).padStart(2, "0"))
        .join("")
    );
  }
  return String(val);
}

function toApiKeyItem(c: APIKeyInfoV2): ApiKeyItem {
  return {
    keyHash: bytesToHex(c.KeyHash),
    rawKey: "",
    prefix: c.Prefix || undefined,
    rateLimit: Number(c.RateLimit ?? 0),
    isActive: Boolean(c.IsActive ?? false),
    createdAt: Number(c.CreatedAt ?? 0),
  };
}

/**
 * 个人 API Key 管理。
 * - 查询：链上 getAPIKeysByOwner（不保留本地缓存，打开即刷新）
 * - 创建：本地生成密钥 → blake2b 哈希 → 仅上链哈希 + 前缀 + 速率限制
 *   （原始密钥仅创建时展示一次，之后无法再获取）
 * - 编辑速率限制 / 吊销
 */
export function useApiKeys() {
  const wallet = useWeb3Wallet();
  const qc = useQueryClient();
  const address = wallet?.address ?? null;

  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyRaw, setNewKeyRaw] = useState(() => generateAPIKey());
  const [rateLimit, setRateLimit] = useState("0");
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<ApiKeyItem | null>(null);
  const [editingHash, setEditingHash] = useState<string | null>(null);
  const [editingRateLimit, setEditingRateLimit] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const { data: chainKeys = [], isLoading } = useQuery({
    queryKey: ["apiKeys", address],
    queryFn: async () => {
      if (!address) return [];
      return GatewayContractApi.getAPIKeysByOwner(address);
    },
    enabled: !!address,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });

  const allKeys = useMemo<ApiKeyItem[]>(
    () => chainKeys.map(toApiKeyItem),
    [chainKeys]
  );

  const filteredKeys = useMemo(() => {
    const keys = showInactive ? allKeys : allKeys.filter((k) => k.isActive);
    if (!search.trim()) return keys;
    const q = search.toLowerCase();
    return keys.filter(
      (k) =>
        k.keyHash.toLowerCase().includes(q) ||
        k.rawKey.toLowerCase().includes(q)
    );
  }, [allKeys, search, showInactive]);

  const registerKey = useMutation({
    mutationFn: async () => {
      if (!wallet) throw new Error("请先连接钱包");
      const raw = newKeyRaw || generateAPIKey();
      const hash = hashAPIKey(raw);
      const limit = Number(rateLimit) || 0;
      await GatewayContractApi.registerAPIKey(
        wallet,
        hexToBytes(hash) as unknown as string,
        raw.slice(0, 16),
        limit
      );
      return { raw, hash, limit };
    },
    onSuccess: (data) => {
      setJustCreated({
        keyHash: data.hash,
        rawKey: data.raw,
        prefix: data.raw.slice(0, 16),
        rateLimit: data.limit,
        isActive: true,
        createdAt: nowTs(),
      });
      setShowCreate(false);
      setNewKeyRaw(generateAPIKey());
      setRateLimit("0");
      qc.refetchQueries({ queryKey: ["apiKeys", address] });
      toast.success("API Key 已创建");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "创建失败"),
  });

  const revokeKey = useMutation({
    mutationFn: async (keyHash: string) => {
      if (!wallet) throw new Error("请先连接钱包");
      await GatewayContractApi.revokeAPIKey(
        wallet,
        hexToBytes(keyHash) as unknown as string
      );
    },
    onSuccess: () => {
      qc.refetchQueries({ queryKey: ["apiKeys", address] });
      toast.success("已吊销");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "吊销失败"),
  });

  const updateKey = useMutation({
    mutationFn: async ({
      keyHash,
      rateLimit,
    }: {
      keyHash: string;
      rateLimit: number;
    }) => {
      if (!wallet) throw new Error("请先连接钱包");
      await GatewayContractApi.updateAPIKey(
        wallet,
        hexToBytes(keyHash) as unknown as string,
        rateLimit
      );
    },
    onSuccess: () => {
      setEditingHash(null);
      setEditingRateLimit("");
      qc.refetchQueries({ queryKey: ["apiKeys", address] });
      toast.success("已更新");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "更新失败"),
  });

  const startEdit = (keyHash: string, currentRateLimit: number) => {
    setEditingHash(keyHash);
    setEditingRateLimit(String(currentRateLimit));
  };

  const cancelEdit = () => {
    setEditingHash(null);
    setEditingRateLimit("");
  };

  const handleCopy = async (text: string, id: string) => {
    await copyText(text);
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 1500);
  };

  const handleRegenerate = () => {
    setNewKeyRaw(generateAPIKey());
  };

  const resetCreate = () => {
    setShowCreate(false);
    setNewKeyRaw(generateAPIKey());
    setRateLimit("0");
  };

  const dismissCreated = () => {
    setJustCreated(null);
  };

  return {
    wallet,
    address,
    isLoading,
    search,
    setSearch,
    showCreate,
    setShowCreate,
    newKeyRaw,
    setNewKeyRaw,
    rateLimit,
    setRateLimit,
    copiedHash,
    filteredKeys,
    registerKey,
    revokeKey,
    updateKey,
    editingHash,
    editingRateLimit,
    setEditingRateLimit,
    startEdit,
    cancelEdit,
    handleCopy,
    handleRegenerate,
    resetCreate,
    justCreated,
    dismissCreated,
    showInactive,
    setShowInactive,
  };
}
