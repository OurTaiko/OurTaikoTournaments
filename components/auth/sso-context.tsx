"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Viewer } from "@/lib/auth";
import { safeReturnTo } from "@/lib/auth-navigation";

type Session = { user: Viewer | null; demoAllowed: boolean };
type SsoContextValue = Session & {
  loading: boolean;
  busy: boolean;
  error: string;
  refresh: () => Promise<void>;
  login: (returnTo?: string) => void;
  logout: () => Promise<void>;
  loginDemo: () => Promise<void>;
};
const SsoContext = createContext<SsoContextValue | null>(null);

export function SsoProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session>({ user: null, demoAllowed: false });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sequence = useRef(0);
  const mutation = useRef(false);
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    try {
      const response = await fetch("/api/session", { cache: "no-store" });
      const result = await response.json() as Session & { error?: string };
      if (!response.ok) throw new Error(result.error || "无法验证登录状态，请重试。");
      if (request === sequence.current) {
        setSession({ user: result.user, demoAllowed: result.demoAllowed });
        setError("");
      }
    } catch (cause) {
      if (request === sequence.current) {
        setSession({ user: null, demoAllowed: false });
        setError(cause instanceof Error ? cause.message : "无法连接登录服务，请重试。");
      }
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    // Fetch completion updates React state asynchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const onFocus = () => { if (!mutation.current) void refresh(); };
    window.addEventListener("focus", onFocus);
    return () => {
      // Invalidate outstanding requests, not a DOM ref.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      sequence.current++;
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);
  const authenticate = useCallback(async (action: "demo" | "logout") => {
    if (mutation.current) return;
    mutation.current = true;
    sequence.current++;
    setBusy(true);
    try {
      const response = await fetch(`/api/auth/${action}`, { method: "POST" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "操作失败，请重试。");
      setSession({ user: null, demoAllowed: false });
      await refresh();
    } finally { mutation.current = false; setBusy(false); }
  }, [refresh]);
  const value = useMemo<SsoContextValue>(() => ({
    ...session, loading, busy, error, refresh,
    login: (returnTo = window.location.pathname + window.location.search) => {
      // OIDC starts at a route handler and requires a full document navigation.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/api/auth/login?returnTo=" + encodeURIComponent(safeReturnTo(returnTo)));
    },
    logout: () => authenticate("logout"),
    loginDemo: () => authenticate("demo"),
  }), [session, loading, busy, error, refresh, authenticate]);
  return <SsoContext.Provider value={value}>{children}</SsoContext.Provider>;
}

export function useSSO() {
  const context = useContext(SsoContext);
  if (!context) throw new Error("useSSO must be used within SsoProvider");
  return context;
}
