import type { Metadata } from "next";
import "./globals.css";
import localFont from "next/font/local";
const chill = localFont({ src: "../public/ourtaiko/ChillRoundF.woff2", variable: "--font-chill", display: "swap", preload: false });
import { SsoProvider } from "@/components/auth/sso-context";
export const metadata: Metadata = {
  title: "OurTaiko Tournaments · 太鼓赛事",
  description: "发现太鼓赛事，查看对阵、成绩与赛事回顾。",
  icons: { icon: "/ourtaiko/icon-32.png" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className={chill.variable}><SsoProvider>{children}</SsoProvider></body>
    </html>
  );
}
