"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

type ThemeMode = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: ThemeMode;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(resolved: "light" | "dark") {
  const root = document.documentElement;
  if (resolved === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");
  const [loaded, setLoaded] = useState(false);

  // Load saved preference on mount
  useEffect(() => {
    async function loadPreference() {
      const user = getCurrentUser();

      // Try local cache first for instant paint (no flash)
      const cached = localStorage.getItem("integrio_theme") as ThemeMode | null;
      if (cached) {
        setThemeState(cached);
        const resolved = cached === "system" ? getSystemTheme() : cached;
        setResolvedTheme(resolved);
        applyTheme(resolved);
      }

      // Then sync from DB if logged in
      if (user) {
        const { data } = await supabase
          .from("User")
          .select("theme_preference")
          .eq("id", user.id)
          .single();

        if (data?.theme_preference) {
          const pref = data.theme_preference as ThemeMode;
          setThemeState(pref);
          localStorage.setItem("integrio_theme", pref);
          const resolved = pref === "system" ? getSystemTheme() : pref;
          setResolvedTheme(resolved);
          applyTheme(resolved);
        }
      }

      setLoaded(true);
    }
    loadPreference();
  }, []);

  // Listen for system theme changes when in "system" mode
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    function handleChange() {
      const resolved = getSystemTheme();
      setResolvedTheme(resolved);
      applyTheme(resolved);
    }
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, [theme]);

  async function setTheme(newTheme: ThemeMode) {
    setThemeState(newTheme);
    localStorage.setItem("integrio_theme", newTheme);
    const resolved = newTheme === "system" ? getSystemTheme() : newTheme;
    setResolvedTheme(resolved);
    applyTheme(resolved);

    // Persist to DB
    const user = getCurrentUser();
    if (user) {
      await supabase
        .from("User")
        .update({ theme_preference: newTheme })
        .eq("id", user.id);
    }
  }

  if (!loaded) return null; // prevent flash of wrong theme

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
