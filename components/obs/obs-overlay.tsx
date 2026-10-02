"use client";

import { useEffect, useState } from "react";
import type { ObsMatch } from "@/lib/obs-matches";
import { difficultyNames, type SongCatalog } from "@/lib/songs";
import { cn } from "@/lib/utils";
import { useObsFeed } from "./use-obs-feed";

const number = (value: number | null) => value === null ? "—" : value.toLocaleString("en-US");

export function ObsMatchCard({ match, catalog }: { match: ObsMatch; catalog: SongCatalog }) {
  return <>
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-white/10 px-7 py-4 phone:px-4">
      <span className="rounded-md bg-cyan-300 px-2.5 py-1 text-sm font-bold text-slate-950">{match.station || "待定"} 台</span>
      <span className="text-sm font-semibold text-cyan-200">{match.stage}</span>
      <span className="text-sm text-slate-300">{match.title}</span>
    </div>
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 px-7 py-6 phone:gap-2 phone:px-4 phone:py-4">
      {([0, 1] as const).map(side => <div key={side} className={cn("min-w-0", side === 1 && "col-start-3 text-right")}>
        <div className={cn("mb-1 text-[11px] font-bold tracking-[0.18em]", side === 0 ? "text-cyan-300" : "text-rose-300")}>{side === 0 ? "PLAYER 01" : "PLAYER 02"}</div>
        <h2 className="m-0 text-3xl font-bold wrap-anywhere phone:text-xl">{match.players[side]}</h2>
        <p className="mt-2 mb-0 text-3xl font-semibold tabular-nums phone:text-xl">{number(match.totals[side])}</p>
      </div>)}
      <div className="col-start-2 row-start-1 text-center">
        <span className="text-xl font-black italic text-slate-500 phone:text-base">VS</span>
      </div>
    </div>
    <p className="mx-7 mt-0 mb-3 text-center text-xs tracking-widest text-slate-400 phone:mx-4">{match.scoreLabel}</p>
    <div className="mx-7 mb-5 overflow-hidden rounded-xl border border-white/10 phone:mx-4">
      <table className="w-full table-fixed border-collapse text-sm phone:text-xs">
        <caption className="sr-only">{match.players.join(" 对 ")} · 逐曲比分</caption>
        <thead className="bg-white/5 text-slate-400">
          <tr>
            <th className="w-[52%] px-4 py-2 text-left font-medium phone:w-[44%] phone:px-2" scope="col">比赛曲目</th>
            <th className="px-2 py-2 text-right font-medium text-cyan-200" scope="col">P1</th>
            <th className="px-4 py-2 text-right font-medium text-rose-200 phone:px-2" scope="col">P2</th>
          </tr>
        </thead>
        <tbody>{match.scores.map((score, i) => {
          const song = catalog[score.songId];
          return <tr key={`${score.songId}-${i}`} className="border-t border-white/10">
            <th scope="row" className="px-4 py-3 text-left font-medium wrap-anywhere phone:px-2">
              <span className="mb-0.5 block text-[10px] font-normal text-slate-400">{String(i + 1).padStart(2, "0")}{song ? ` · ${difficultyNames[song.difficultyIndex]} · ★ ${song.stars ?? "—"}` : ""}</span>
              {song?.title ?? "曲目信息加载中"}
            </th>
            <td className={cn("px-2 py-3 text-right tabular-nums", score.a !== null && score.b !== null && score.a > score.b && "font-bold text-cyan-200")}>{number(score.a)}</td>
            <td className={cn("px-4 py-3 text-right tabular-nums phone:px-2", score.a !== null && score.b !== null && score.b > score.a && "font-bold text-rose-200")}>{number(score.b)}</td>
          </tr>;
        })}</tbody>
      </table>
      {!match.scores.length && <p className="p-4 text-center text-sm text-slate-400">等待比赛曲目</p>}
    </div>
  </>;
}

export default function ObsOverlay({ name, apiPath }: { name: string; apiPath: string | null }) {
  const { matches, catalog, loaded, disconnected, songsUnavailable } = useObsFeed(apiPath);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Membership alone controls the timer; polling scores must not restart the rotation.
  const membership = JSON.stringify(matches.map(m => m.id));
  useEffect(() => {
    const ids = JSON.parse(membership) as string[];
    if (ids.length < 2) return;
    const timer = setInterval(() => setActiveId(current => {
      const index = Math.max(0, ids.indexOf(current ?? ""));
      return ids[(index + 1) % ids.length];
    }), 3000);
    return () => clearInterval(timer);
  }, [membership]);
  const index = Math.max(0, matches.findIndex(m => m.id === activeId));

  return <main data-obs-overlay className="w-full max-w-[960px] p-4 text-white phone:p-2">
    <section className="overflow-hidden rounded-2xl border border-white/15 bg-slate-950/95 shadow-xl">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-7 py-4 phone:px-4 phone:py-3">
        <div className="min-w-0">
          <p className="m-0 text-[10px] font-bold tracking-[0.24em] text-slate-400">OURTAIKO TOURNAMENTS</p>
          <h1 className="mt-1 mb-0 text-base font-semibold wrap-anywhere phone:text-sm">{name}</h1>
        </div>
        <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-cyan-200">
          <span className={cn("h-1.5 w-1.5 rounded-full", matches.length ? "bg-cyan-300" : "bg-slate-500")} />
          {matches.length ? "正在进行" : apiPath ? "等待开赛" : "赛事已结束"}
        </span>
      </header>
      <div className="grid">
        {matches.map((match, i) => <article
          key={match.id} data-match-id={match.id} aria-hidden={i !== index}
          className={cn("min-w-0 [grid-area:1/1] transition-opacity duration-500 ease-in-out", i === index ? "z-10 opacity-100" : "pointer-events-none opacity-0")}
        ><ObsMatchCard match={match} catalog={catalog} /></article>)}
      </div>
      {!matches.length && <div className="px-6 py-12 text-center">
        <p className="m-0 text-xl font-semibold">{!apiPath ? "赛事已结束" : disconnected ? "正在重新连接赛况…" : loaded ? "等待下一场比赛" : "正在连接赛况…"}</p>
        <p className="mt-2 mb-0 text-sm text-slate-400">{!apiPath ? "本届比赛已存档" : "比赛开始后自动显示对阵"}</p>
      </div>}
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-7 py-3 text-[11px] text-slate-400 phone:px-4">
        <span role="status" className={cn(disconnected && "text-amber-300")}>
          {disconnected ? (loaded ? "同步中断 · 显示上次赛况 · 正在重试" : "连接暂不可用 · 正在重试") : songsUnavailable ? "部分曲目信息暂不可用 · 正在重试" : "OURTAIKO · 太鼓赛事"}
        </span>
        {matches.length > 1 && <span className="tabular-nums">{index + 1} / {matches.length} · 每 3 秒轮换</span>}
      </footer>
    </section>
  </main>;
}
