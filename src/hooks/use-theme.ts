import { useEffect, useState } from "react";

const KEY = "medai-theme";

export function useTheme() {
  // Always start with "light" to match SSR; sync on mount.
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(KEY) as "light" | "dark" | null;
    const initial =
      stored ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(initial);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    localStorage.setItem(KEY, theme);
  }, [theme, mounted]);

  return {
    theme,
    mounted,
    toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
  };
}
