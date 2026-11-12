import { WithdrawCard } from "@/features/withdraw/WithdrawCard";

/** 余额提现 tab — 提现表单 + 历史直接内联展示（不走二次 modal） */
export function BalanceTab({
  id,
  address,
}: {
  id: number;
  address: string | undefined;
}) {
  return <WithdrawCard id={id} address={address} index="01" />;
}
