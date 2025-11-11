"use client";
import React, { useEffect, useState, useRef } from "react";

const THEME_KEY = "theme";

type ThemeMode = "light" | "dark" | "system";

function getSystemPref(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export default function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    try {
      const s = localStorage.getItem(THEME_KEY) as ThemeMode | null;
      return s || "system";
    } catch (e) {
      return "system";
    }
  });

  const mqRef = useRef<MediaQueryList | null>(null);

  useEffect(() => {
    const apply = () => {
      const themeToSet = mode === "system" ? getSystemPref() : mode;
      if (typeof document !== "undefined")
        document.documentElement.setAttribute("data-theme", themeToSet);
    };

    apply();
    try {
      localStorage.setItem(THEME_KEY, mode);
    } catch (e) {
      /* ignore */
    }

    if (typeof window !== "undefined" && mode === "system") {
      const mql = window.matchMedia("(prefers-color-scheme: dark)");
      mqRef.current = mql;
      const handler = () => apply();
      if (mql.addEventListener) mql.addEventListener("change", handler);
      else mql.addListener(handler);
      return () => {
        if (mqRef.current) {
          try {
            mqRef.current.removeEventListener?.("change", handler);
          } catch {
            // Safari fallback
            // @ts-ignore
            mqRef.current.removeListener && // eslint-disable-line
              // @ts-ignore
              mqRef.current.removeListener(handler);
          }
        }
      };
    }
    return;
  }, [mode]);

  const cycle = () =>
    setMode((m) =>
      m === "light" ? "dark" : m === "dark" ? "system" : "light"
    );

  const title =
    mode === "system"
      ? "Theme: system (follows OS). Click to switch to light"
      : mode === "dark"
      ? "Theme: dark. Click to switch to system"
      : "Theme: light. Click to switch to dark";

  const ariaLabel = `Toggle theme (current: ${mode})`;

  return (
    <button
      className="btn ghost"
      onClick={cycle}
      aria-pressed={mode === "dark"}
      aria-label={ariaLabel}
      title={title}
      style={{ minWidth: 48, padding: "0 10px" }}
    >
      {mode === "dark" ? (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : mode === "light" ? (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 3v2"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M12 19v2"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M4.2 4.2l1.4 1.4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M18.4 18.4l1.4 1.4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M1 12h2"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M21 12h2"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M4.2 19.8l1.4-1.4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M18.4 5.6l1.4-1.4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx="12"
            cy="12"
            r="3"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 3v2"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M12 19v2"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M1 12h2"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M21 12h2"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M7 12a5 5 0 1010 0 5 5 0 00-10 0z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
