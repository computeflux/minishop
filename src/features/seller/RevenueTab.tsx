import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { SectionLabel, StateBlock } from "@/ui/kit";
import { useProviderSettlements } from "@/hooks/useShops";
import {
  formatTimestamp,
  shortenAddress,
  formatCredits,
} from "@/shared/utils";
import { cn } from "@/shared/lib/utils";

/** 收益记录 tab — 卖家结算明细 */
export function RevenueTab({ id }: { id: number }) {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useProviderSettlements(id);
  const records = data ?? [];
  const total = useMemo(
    () => records.reduce((acc, r) => acc + (Number(r.Cost) || 0), 0),
    [records]
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        {/*<div>
          <SectionLabel index="01" title={t("minishop.seller.tab_revenue", "收益记录")} count={records.length} />
          <p className="mt-1 text-[11px] text-white/30">
            {t("minishop.seller.settlement_desc", "买家在本店各商品上的链上结算")}
          </p>
        </div>*/}
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] text-white/35">{t("minishop.seller.cumulative", "累计结算")}</span>
          <span className="num text-xl text-white">
            ${formatCredits(total)}
          </span>
        </div>
      </div>
      <div className="mt-4">
        {isLoading ? (
          <StateBlock state="loading" title={t("minishop.seller.settlement_loading", "正在读取结算记录…")} />
        ) : isError ? (
          <StateBlock state="error" title={t("minishop.seller.settlement_error", "结算记录加载失败。")} />
        ) : records.length === 0 ? (
          <StateBlock
            title={t("minishop.seller.no_settlement", "暂无结算记录")}
            desc={t("minishop.seller.no_settlement_desc", "买家消费你的算力后，记录会实时出现在这里。")}
          />
        ) : (
          <div className="overflow-x-auto border border-white/10">
            <table className="w-full min-w-[560px] text-[13px]">
              <thead>
                <tr className="border-b border-white/10">
                  {[
                    { key: t("minishop.seller.buyer", "买家") },
                    { key: t("minishop.seller.product", "商品") },
                    { key: t("minishop.seller.count", "次数") },
                    { key: t("minishop.seller.settlement_amount", "结算金额") },
                    { key: t("minishop.seller.time", "时间") },
                  ].map((h, i) => (
                    <th
                      key={h.key}
                      className={cn(
                        "px-4 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-white/35",
                        i >= 2 ? "text-right" : "text-left"
                      )}
                    >
                      {h.key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr
                    key={i}
                    className="border-b border-white/10 last:border-b-0 hover:bg-white/[0.03]"
                  >
                    <td className="num px-4 py-3 text-white/70">
                      {shortenAddress(r.User?.V)}
                    </td>
                    <td className="num px-4 py-3 text-white/70">
                      #{r.ModelID}
                    </td>
                    <td className="num px-4 py-3 text-right text-white/50">
                      {r.Count}
                    </td>
                    <td className="num px-4 py-3 text-right text-white">
                      ${formatCredits(r.Cost)}
                    </td>
                    <td className="num px-4 py-3 text-right text-xs text-white/40">
                      {formatTimestamp(Number(r.Time))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
