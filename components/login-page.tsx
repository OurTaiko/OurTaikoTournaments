"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, Cat, ShieldCheck } from "lucide-react";
import type { Viewer } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [user, setUser] = useState<Viewer | null>(null);
  const [demoAllowed, setDemoAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sessionError, setSessionError] = useState("");

  const loadSession = useCallback(async () => {
    try {
      const response = await fetch("/api/session", { cache: "no-store" });
      const result = await response.json() as { user: Viewer | null; demoAllowed: boolean; error?: string };
      if (!response.ok) throw new Error(result.error || "无法验证登录状态，请重试。");
      setSessionError("");
      setUser(result.user);
      setDemoAllowed(result.demoAllowed);
    } catch (e) {
      setSessionError(e instanceof Error ? e.message : "无法连接登录服务，请重试。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const message = new URLSearchParams(location.search).get("authError");
    // Session and callback errors are hydrated from the server/browser after mounting.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSession().then(() => {
      if (message) {
        setError(message);
        history.replaceState(null, "", location.pathname);
      }
    });
  }, [loadSession]);

  async function authenticate(action: "demo" | "logout") {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/auth/${action}`, { method: "POST" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "操作失败，请重试。");
      if (action === "demo") {
        router.push("/?manage=1");
      } else {
        setUser(null);
        await loadSession();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "连接失败，请重试。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" href="/">
            <span className="brand-icon"><Cat size={25} /></span>
            HachiCats<span className="edition">八猫杯</span>
          </Link>
          <Link className="login" href="/" aria-label="返回赛事"><ArrowLeft size={16} /><span>返回赛事</span></Link>
        </div>
      </header>
      <main className="login-page">
        <section className="login-card" aria-labelledby="login-heading">
          <span className="login-emblem"><ShieldCheck size={30} /></span>
          <span className="event-kicker">HACHICATS · OURTAIKO</span>
          <h1 id="login-heading">{user ? "你的赛事账号" : "登录八猫杯"}</h1>
          <p className="login-description">{user
            ? `${user.name}，${user.admin ? "你已获得赛事管理权限。" : "此账号暂无赛事管理权限，请联系主办方授权。"}`
            : "使用 OurTaiko 账号登录，进入赛事管理。"}</p>
          {error && <p className="login-error" role="alert">{error}</p>}
          {sessionError && <div className="login-error" role="alert">
            <p>{sessionError}</p>
            <button className="text-button" disabled={loading} onClick={() => { setLoading(true); void loadSession(); }}>重新验证</button>
          </div>}
          {loading ? <p role="status">正在验证登录状态…</p> : (
            <div className="login-actions">
              {user ? <>
                <Link className="primary-button" href={user.admin ? "/?manage=1" : "/"}>
                  {user.admin ? "进入赛事管理" : "返回赛事"}<ArrowUpRight size={16} />
                </Link>
                <button className="secondary-button" disabled={busy} onClick={() => void authenticate("logout")}>{busy ? "正在退出…" : "退出当前账号"}</button>
              </> : <>
                <form action="/api/auth/login" method="get"><button className="primary-button" type="submit">使用 OurTaiko 登录<ArrowUpRight size={16} /></button></form>
                {demoAllowed && <button className="secondary-button" disabled={busy} onClick={() => void authenticate("demo")}>{busy ? "正在进入…" : "体验演示管理模式"}</button>}
              </>}
            </div>
          )}
          <p className="login-footnote">观看赛况无需登录。<br />赛事管理仅向已获主办方授权的账号开放。</p>
          <Link className="login-back" href="/"><ArrowLeft size={14} />返回赛事对阵</Link>
        </section>
      </main>
    </>
  );
}
