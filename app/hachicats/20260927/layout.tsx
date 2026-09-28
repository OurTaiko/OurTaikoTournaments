import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "第一届八猫杯 · HachiCats",
  description: "2026 年 9 月 27 日八猫杯：赛事总结、实时对阵、比赛成绩与分组曲库。",
};
export default function TournamentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
