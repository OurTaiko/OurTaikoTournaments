import type { Metadata } from "next";
import "./globals.css";
import { SsoProvider } from "@/components/auth/sso-context";
export const metadata: Metadata = {
  title: "OurTaiko Tournaments · 太鼓赛事",
  description: "发现太鼓赛事，查看对阵、成绩与赛事回顾。",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body><SsoProvider>{children}</SsoProvider></body>
    </html>
  );
}
