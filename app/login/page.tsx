import type { Metadata } from "next";
import LoginPage from "@/components/login-page";

export const metadata: Metadata = {
  title: "登录 · HachiCats 八猫杯",
  description: "使用 OurTaiko 账号登录八猫杯赛事管理。",
};

export default function Login() {
  return <LoginPage />;
}
