import type { Metadata } from "next";
import LoginPage from "@/components/login-page";
import { safeReturnTo } from "@/lib/auth-navigation";

export const metadata: Metadata = {
  title: "登录 · OurTaiko Tournaments",
  description: "使用 OurTaiko 账号登录赛事平台。",
};

export default async function Login({ searchParams }: {
  searchParams: Promise<{ returnTo?: string | string[]; authError?: string | string[] }>;
}) {
  const params = await searchParams;
  return <LoginPage returnTo={safeReturnTo(typeof params.returnTo === "string" ? params.returnTo : "/")}
    authError={typeof params.authError === "string" ? params.authError : undefined} />;
}
