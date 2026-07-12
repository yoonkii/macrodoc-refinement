"use client";

// ---------------------------------------------------------------------------
// Minimal theme provider — a drop-in replacement for next-themes.
//
// Why not next-themes: its ThemeProvider renders its no-flash <script> inside
// the React tree (in <body>), which React 19.2 rejects with "Encountered a
// script tag while rendering React component" → minified hydration error #418
// in production. We instead render the blocking init script once in <head> from
// the (server-rendered) root layout — valid, executes pre-paint, no warning —
// and keep only React state/context here.
//
// API parity with the slice of next-themes we used: `useTheme()` returns
// `{ theme, setTheme }`, and `theme` is `undefined` until mounted (so consumers
// that gate theme-dependent rendering on a defined theme keep working and there
// is no SSR/client hydration mismatch).
// ---------------------------------------------------------------------------

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark" | "mdr";

export const THEMES: Theme[] = ["light", "dark", "mdr"];
export const THEME_STORAGE_KEY = "theme";
export const DEFAULT_THEME: Theme = "dark";

/**
 * Blocking script string applied in <head> before paint. Reads the stored
 * theme, applies the matching class + color-scheme, and falls back to the
 * default on any error (private mode, disabled storage). Kept dependency-free
 * and tiny so it can run inline. `mdr` is a dark-family theme for color-scheme.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var k=${JSON.stringify(
  THEME_STORAGE_KEY,
)};var d=document.documentElement;var t=localStorage.getItem(k);var v=(t==='light'||t==='dark'||t==='mdr')?t:${JSON.stringify(
  DEFAULT_THEME,
)};['light','dark','mdr'].forEach(function(x){d.classList.remove(x)});d.classList.add(v);d.style.colorScheme=v==='light'?'light':'dark';}catch(e){var d=document.documentElement;d.classList.add(${JSON.stringify(
  DEFAULT_THEME,
)});d.style.colorScheme='dark';}})();`;

function applyTheme(theme: Theme): void {
  const el = document.documentElement;
  THEMES.forEach((t) => el.classList.remove(t));
  el.classList.add(theme);
  el.style.colorScheme = theme === "light" ? "light" : "dark";
}

interface ThemeContextValue {
  /** Undefined until mounted — mirrors next-themes so consumers can gate on it. */
  theme: Theme | undefined;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme | undefined>(undefined);

  // On mount, adopt whatever the <head> script already applied (or the default),
  // keeping React state in sync with the DOM without a second flash.
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      // storage blocked — fall through to default
    }
    const initial: Theme =
      stored === "light" || stored === "dark" || stored === "mdr"
        ? stored
        : DEFAULT_THEME;
    setThemeState(initial);
    applyTheme(initial);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // storage blocked — theme still applies for this session
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Returns the current theme (undefined until mounted) and a setter. */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext) ?? { theme: undefined, setTheme: () => {} };
}
