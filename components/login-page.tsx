"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowUpRight, ShieldCheck, Trophy } from "lucide-react";
import { useSSO } from "@/components/auth/sso-context";
import { brand, brandIcon, edition, login as loginLink, primaryButton, secondaryButton, textButton, topbar, topbarInner } from "@/components/styles";

const loginError = "rounded-[10px] bg-[#fff2f0] p-3 text-[#b42318] text-[13px] leading-[1.7] text-left mt-5 wrap-anywhere";

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
      <header className={topbar}>
        <div className={topbarInner}>
          <Link className={brand} href="/"><span className={brandIcon}><Trophy size={25} /></span>OurTaiko<span className={edition}>赛事</span></Link>
          <Link className={loginLink} aria-label="返回" href={returnTo}><ArrowLeft size={16} /><span>返回</span></Link>
        </div>
      </header>
      <main className="min-h-[calc(100svh-75px)] grid place-items-center py-12 px-5 mobile:py-8 mobile:[align-items:start]">
        <section className="w-full max-w-[460px] p-10 rounded-[16px] bg-white text-center shadow-[0_4px_12px_rgb(0_0_0/8%)] mobile:py-[30px] mobile:px-6" aria-labelledby="login-heading">
          <span className="inline-flex items-center justify-center w-16 h-16 rounded-[18px] bg-accent text-primary mb-6"><ShieldCheck size={30} /></span>
          <h1 id="login-heading" className="text-[28px] font-[650] my-3 tracking-[-0.6px]">{user ? "你的赛事账号" : "登录 OurTaiko"}</h1>
          <p className="text-[14px] leading-[1.8] text-[#6e6e73] wrap-anywhere">{user ? `${user.name}，欢迎回来。` : "一个 OurTaiko 账号，连接每一场赛事。"}</p>
          {error && <p className={loginError} role="alert">{error}</p>}
          {sessionError && <div className={loginError} role="alert"><p>{sessionError}</p><button className={textButton} disabled={loading || busy} onClick={() => void refresh()}>重新验证</button></div>}
          {loading ? <p role="status">正在验证登录状态…</p> : (
            <div className="grid gap-3 mt-7 [&_button:disabled]:opacity-55 [&_button:disabled]:cursor-wait">
              {user ? <>
                <Link className={primaryButton} href={returnTo}>继续浏览<ArrowUpRight size={16} /></Link>
                <button className={secondaryButton} disabled={busy} onClick={() => void authenticate("logout")}>{busy ? "正在退出…" : "退出当前账号"}</button>
              </> : <>
                <button className={primaryButton} disabled={busy} onClick={() => login(returnTo)}>使用 OurTaiko 登录<ArrowUpRight size={16} /></button>
                {demoAllowed && <button className={secondaryButton} disabled={busy} onClick={() => void authenticate("demo")}>{busy ? "正在进入…" : "体验演示管理模式"}</button>}
              </>}
            </div>
          )}
          <p className="border-t border-line pt-6 mt-7 text-[12px] leading-[1.9] text-[#77777f]">观看赛况无需登录。<br />各赛事管理权限由主办方授权。</p>
          <Link className="inline-flex items-center gap-1.5 mt-[18px] text-primary text-[13px]" href="/"><ArrowLeft size={14} />浏览全部赛事</Link>
        </section>
      </main>
    </>
  );
}
