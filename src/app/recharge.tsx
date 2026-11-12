import { createContext, useContext, useState } from "react";

/**
 * Global "充值积分" modal state.
 * Replaces the old ShopContext: recharge is a *buyer* action and must be
 * reachable from every surface (header, shop page, model page, dashboard).
 */
type RechargeCtx = {
  open: boolean;
  setOpen: (open: boolean) => void;
  openRecharge: () => void;
};

const Ctx = createContext<RechargeCtx>({
  open: false,
  setOpen: () => {},
  openRecharge: () => {},
});

export function RechargeProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Ctx.Provider
      value={{ open, setOpen, openRecharge: () => setOpen(true) }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useRechargeModal() {
  return useContext(Ctx);
}
