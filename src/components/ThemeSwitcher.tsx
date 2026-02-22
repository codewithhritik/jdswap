"use client";

import { useCallback, useEffect, useState } from "react";

type Theme = "dark" | "light";

const THEME_STORAGE_KEY = "jdswap-theme";

function getThemeFromDocument(): Theme {
  if (typeof document === "undefined") return "dark";
  const dataTheme = document.documentElement.dataset.theme;
  if (dataTheme === "light" || dataTheme === "dark") return dataTheme;

  try {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === "light" || storedTheme === "dark") return storedTheme;
  } catch {}

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {}
}

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const resolvedTheme = getThemeFromDocument();
    applyTheme(resolvedTheme);
    setTheme(resolvedTheme);
    setMounted(true);
  }, []);

  useEffect(() => {
    function syncTheme() {
      setTheme(getThemeFromDocument());
    }

    window.addEventListener("storage", syncTheme);
    return () => window.removeEventListener("storage", syncTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((currentTheme) => {
      const nextTheme = currentTheme === "dark" ? "light" : "dark";
      applyTheme(nextTheme);
      return nextTheme;
    });
  }, []);

  const nextTheme = theme === "dark" ? "light" : "dark";
  const label = mounted ? `Switch to ${nextTheme} mode` : "Toggle color mode";
  const visibleLabel = mounted ? `Switch to ${nextTheme}` : "Theme";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      aria-pressed={theme === "light"}
      className="group inline-flex min-h-11 items-center gap-2 rounded-full border border-surface-border/90 bg-surface/85 px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.14)] backdrop-blur-sm transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base"
    >
      <span className="relative grid h-6 w-6 place-items-center rounded-full border border-surface-border/80 bg-base/70">
        <SunIcon
          className={`absolute h-3.5 w-3.5 text-accent transition-all duration-200 ${
            theme === "light" ? "scale-100 opacity-100" : "scale-75 opacity-0"
          }`}
        />
        <MoonIcon
          className={`absolute h-3.5 w-3.5 text-warm transition-all duration-200 ${
            theme === "dark" ? "scale-100 opacity-100" : "scale-75 opacity-0"
          }`}
        />
      </span>
      <span className="text-[11px] font-mono uppercase tracking-[0.12em] text-warm-muted transition-colors group-hover:text-warm">
        {visibleLabel}
      </span>
    </button>
  );
}

function SunIcon({ className }: { className: string }) {
  return (
    <svg className={className} aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <circle cx="12" cy="12" r="4" strokeWidth={1.7} />
      <path
        strokeWidth={1.7}
        strokeLinecap="round"
        d="M12 2.5v2.2m0 14.6v2.2m9.5-9.5h-2.2M4.7 12H2.5m16.2 6.2-1.6-1.6M6.9 6.9 5.3 5.3m13.4 0-1.6 1.6M6.9 17.1l-1.6 1.6"
      />
    </svg>
  );
}

function MoonIcon({ className }: { className: string }) {
  return (
    <svg className={className} aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.1 14.8A8.9 8.9 0 1 1 9.2 3.9a7.3 7.3 0 0 0 10.9 10.9Z"
      />
    </svg>
  );
}
