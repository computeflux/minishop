import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UserInfo {
  addr: string;
  [key: string]: unknown;
}

type Theme = "dark" | "light" | "system";

interface GlobalState {
  userInfo: UserInfo | null;
  chainId: string | null;
  theme: Theme;
  resolvedTheme: "dark" | "light";
  setUserInfo: (info: UserInfo | null) => void;
  setChainId: (id: string | null) => void;
  setTheme: (theme: Theme) => void;
}

function resolveTheme(_theme: Theme): "dark" | "light" {
  return "dark";
}

function applyTheme(theme: "dark" | "light") {
  const html = document.documentElement;
  if (theme === "dark") {
    html.classList.add("dark");
  } else {
    html.classList.remove("dark");
  }
}

export const useGlobalStore = create<GlobalState>()(
  persist(
    (set, _get) => ({
      userInfo: null,
      chainId: null,
      theme: "dark",
      resolvedTheme: "dark",
      setUserInfo: (info) => set({ userInfo: info }),
      setChainId: (id) => set({ chainId: id }),
      setTheme: (theme) => {
        const resolved = resolveTheme(theme);
        applyTheme(resolved);
        set({ theme, resolvedTheme: resolved });
      },
    }),
    {
      name: "minishop-global",
      partialize: (state) => ({
        userInfo: state.userInfo,
        chainId: state.chainId,
        theme: state.theme,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const resolved = resolveTheme(state.theme);
        applyTheme(resolved);
        state.resolvedTheme = resolved;
      },
    }
  )
);

export function initTheme() {
  // Always force dark theme
  const theme: Theme = "dark";
  const resolved = resolveTheme(theme);
  applyTheme(resolved);
  useGlobalStore.setState({ theme, resolvedTheme: resolved });
}

export function getDefaultTheme(): Theme {
  return "dark";
}
