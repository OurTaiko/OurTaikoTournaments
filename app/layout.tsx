import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "第一届八猫杯 · HachiCats",
  description: "第一届八猫杯赛事现场：实时对阵、比赛成绩与分组曲库。",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
