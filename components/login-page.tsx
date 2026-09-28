"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowUpRight, ShieldCheck, Trophy } from "lucide-react";
import { useSSO } from "@/components/auth/sso-context";

export default function LoginPage({ returnTo, authError }: { returnTo: string; authError?: string }) {
  const router = useRouter();
  const { user, demoAllowed, loading, busy, error: sessionError, refresh, login, logout, loginDemo } = useSSO();
  const [error, setError] = useState(authError || "");

  async function authenticate(action: "demo" | "logout") {
    setError("");
    try {
      if (action === "demo") {
        await loginDemo();
        router.push(returnTo);
      } else await logout();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "连接失败，请重试。");
    }
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" href="/"><span className="brand-icon"><Trophy size={25} /></span>OurTaiko<span className="edition">赛事</span></Link>
          <Link className="login" aria-label="返回" href={returnTo}><ArrowLeft size={16} /><span>返回</span></Link>
        </div>
      </header>
      <main className="login-page">
        <section className="login-card" aria-labelledby="login-heading">
          <span className="login-emblem"><ShieldCheck size={30} /></span>
          <h1 id="login-heading">{user ? "你的赛事账号" : "登录 OurTaiko"}</h1>
          <p className="login-description">{user ? `${user.name}，欢迎回来。` : "一个 OurTaiko 账号，连接每一场赛事。"}</p>
          {error && <p className="login-error" role="alert">{error}</p>}
          {sessionError && <div className="login-error" role="alert"><p>{sessionError}</p><button className="text-button" disabled={loading || busy} onClick={() => void refresh()}>重新验证</button></div>}
          {loading ? <p role="status">正在验证登录状态…</p> : (
            <div className="login-actions">
              {user ? <>
                <Link className="primary-button" href={returnTo}>继续浏览<ArrowUpRight size={16} /></Link>
                <button className="secondary-button" disabled={busy} onClick={() => void authenticate("logout")}>{busy ? "正在退出…" : "退出当前账号"}</button>
              </> : <>
                <button className="primary-button" disabled={busy} onClick={() => login(returnTo)}>使用 OurTaiko 登录<ArrowUpRight size={16} /></button>
                {demoAllowed && <button className="secondary-button" disabled={busy} onClick={() => void authenticate("demo")}>{busy ? "正在进入…" : "体验演示管理模式"}</button>}
              </>}
            </div>
          )}
          <p className="login-footnote">观看赛况无需登录。<br />各赛事管理权限由主办方授权。</p>
          <Link className="login-back" href="/"><ArrowLeft size={14} />浏览全部赛事</Link>
        </section>
      </main>
    </>
  );
}
