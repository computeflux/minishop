import { useGlobalStore } from "@/shared/stores/global";

export function useTheme() {
  const theme = useGlobalStore((s) => s.theme);
  const resolvedTheme = useGlobalStore((s) => s.resolvedTheme);
  const setTheme = useGlobalStore((s) => s.setTheme);

  return { theme, resolvedTheme, setTheme };
}
