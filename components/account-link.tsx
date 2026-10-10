"use client";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { useSSO } from "@/components/auth/sso-context";
import { cn } from "@/lib/utils";
import { login } from "@/components/styles";
import { loginHref } from "@/lib/auth-navigation";

export default function AccountLink() {
  const { user, loading, error } = useSSO();
  return <Link className={cn(login, "max-w-[200px] [&_span]:truncate")} aria-label={user ? `账号：${user.name}` : "登录"} href={loginHref("/")}><ShieldCheck size={16} /><span>{loading ? "账号" : error ? "验证账号" : user?.name || "登录"}</span></Link>;
}
