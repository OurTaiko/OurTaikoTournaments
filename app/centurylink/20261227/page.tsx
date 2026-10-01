"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight, CalendarDays, ChevronRight, Drum, GitBranch, ListOrdered, MapPin, Medal, Music2,
  Radio, ShieldCheck, Trophy,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useSSO } from "@/components/auth/sso-context";
import { useTournamentAccess } from "@/components/auth/use-tournament-access";
import { useSongCatalog } from "@/components/use-song-catalog";
import ResetTournament from "@/components/reset-tournament";
import ClMatchEditor from "@/components/centurylink/cl-match-editor";
import ClMatchSummary from "@/components/centurylink/cl-match-summary";
import { ClPlayerManager, ClRankingManager } from "@/components/centurylink/cl-admin";
import { clSongName, clSongNumber, songWikiUrl } from "@/components/centurylink/cl-songs";
import { loginHref } from "@/lib/auth-navigation";
import { CENTURYLINK_TOURNAMENT_ID, tournamentApiPath } from "@/lib/tournaments";
import { difficultyNames, type Song } from "@/lib/songs";
import {
  clBracket, clDefinition, clDesignatedKeys, clDesignatedLabels, clPlayer, clPoints, clSeed,
  clSpecialId, clStages, clStandings, clTotals, makeCenturyLink,
  type CenturyLink, type ClMatch, type ClStage,
} from "@/lib/centurylink";
import type { ClPlayerAction } from "@/lib/centurylink-rules";
import * as s from "@/components/styles";
import { cn } from "@/lib/utils";

const avatar = "flex items-center justify-center mt-auto mx-auto mb-2.5 w-11 h-11 rounded-[50%] bg-[#f2f4f8] text-[#707783] text-[20px] font-medium mobile:w-8 mobile:h-8 mobile:text-[15px] mobile:mb-2";
const versusName = "block wrap-anywhere text-[19px] font-semibold mobile:text-[13px]";
const liveTotal = "block text-[13px] tabular-nums text-primary mt-[5px] mobile:text-[11px]";
const poolTitle = "text-[15px] mt-0 mb-3 flex gap-2 items-baseline";
const poolNote = "text-[#8a8a93] text-[12px] font-medium";
const songLink = "text-inherit hover:text-primary hover:underline hover:underline-offset-3 focus-visible:text-primary focus-visible:underline focus-visible:underline-offset-3";
const tournamentId = CENTURYLINK_TOURNAMENT_ID;
const apiPath = tournamentApiPath(tournamentId);
const pagePath = "/centurylink/20261227";
const initial: CenturyLink = { ...makeCenturyLink(), updatedAt: "" };
const emptyPools: Record<ClStage, string[]> = { 1: [], 2: [], 3: [] };
/** Columns within each stage, following the organiser's bracket sheet. */
const stageColumns: Record<ClStage, { title: string; note: string; ids: string[] }[]> = {
  1: [
    { title: "首轮", note: "胜者进入 1-0 组", ids: ["G1", "G2", "G3", "G4"] },
    { title: "0-1 组", note: "败者获得第 7–8 名", ids: ["G5", "G6"] },
  ],
  2: [
    { title: "1-0 组", note: "胜者进入胜者组决赛", ids: ["G7", "G8"] },
    { title: "1-1 组", note: "败者获得第 5–6 名", ids: ["G9", "G10"] },
    { title: "殿军赛", note: "败者获得第 4 名", ids: ["G11"] },
  ],
  3: [
    { title: "胜者组决赛", note: "败者进入败者组决赛", ids: ["G12"] },
    { title: "败者组决赛", note: "败者获得季军", ids: ["G13"] },
    { title: "总决赛", note: "决出冠亚军", ids: ["G14"] },
  ],
};
const sourceLabel = (id: string, side: "a" | "b") => {
  const source = clDefinition(id)[side];
  return "seed" in source ? `排位 #${source.seed}` : "winner" in source ? `${source.winner} 胜者` : `${source.loser} 败者`;
};

export default function CenturyLinkPage() {
  const { catalog, pools, notice: songNotice, refresh: refreshSongs } = useSongCatalog(tournamentId, emptyPools);
  const [view, setView] = useState("bracket");
  const [stage, setStage] = useState<ClStage>(1);
  const [tournament, setTournament] = useState<CenturyLink>(initial);
  const [loaded, setLoaded] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [demo, setDemo] = useState(false);
  const [selectedDraft, setSelected] = useState<ClMatch | null>(null);
  const [editorRevision, setEditorRevision] = useState(0);
  const [editorPool, setEditorPool] = useState<Song[]>([]);
  const [designated, setDesignated] = useState<Song | null>(null);
  const [manage, setManage] = useState(true);
  const [opening, setOpening] = useState(false);
  const [savingPlayer, setSavingPlayer] = useState(false);
  const playerSaveLock = useRef(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string; id: number } | null>(null);
  const toast = {
    success: (text: string) => setNotice(previous => ({ kind: "success", text, id: (previous?.id ?? 0) + 1 })),
    error: (text: string) => setNotice(previous => ({ kind: "error", text, id: (previous?.id ?? 0) + 1 })),
  };
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(current => current?.id === notice.id ? null : current), 3500);
    return () => clearTimeout(timer);
  }, [notice]);
  const { user, logout } = useSSO();
  const { canManage, loading: sessionLoading, error: sessionError, refresh: loadSession } = useTournamentAccess(tournamentId);

  const load = useCallback(async () => {
    try {
      const r = await fetch(apiPath, { cache: "no-store" });
      const d = await r.json() as { error?: string; tournament: CenturyLink; demo: boolean };
      if (!r.ok) throw Error(d.error);
      setTournament(previous => d.tournament.revision >= previous.revision ? d.tournament : previous);
      setDemo(d.demo);
      setLoaded(true);
      setConnectionError("");
    } catch (e) {
      setConnectionError(e instanceof Error && e.message ? e.message : "赛况连接中断。");
    }
  }, []);
  useEffect(() => {
    // Hydrate the public snapshot after mounting; requests update state asynchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const interval = setInterval(() => void load(), 3000);
    const params = new URLSearchParams(location.search);
    const requested = params.get("view");
    if (requested && ["bracket", "ranking", "songs", "rules"].includes(requested)) setView(requested);
    if (params.has("authError"))
      location.replace("/login?authError=" + encodeURIComponent(params.get("authError") || "登录未完成，请重试。"));
    if (params.has("manage")) {
      setView("admin");
      history.replaceState(null, "", location.pathname);
    }
    return () => clearInterval(interval);
  }, [load]);

  async function savePlayers(action: ClPlayerAction, revision: number) {
    if (playerSaveLock.current) return false;
    playerSaveLock.current = true;
    setSavingPlayer(true);
    try {
      const response = await fetch(apiPath + "/players", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, revision }) });
      const result = await response.json() as { error?: string; tournament: CenturyLink };
      if (!response.ok) throw new Error(result.error || "保存失败，请稍后重试。");
      setTournament(previous => result.tournament.revision >= previous.revision ? result.tournament : previous);
      toast.success(action.type === "ranking-confirm" ? "排位已确认，首轮对阵已生成" : action.type === "ranking-scores" ? "排位分数已保存" : "已保存");
      if (action.type === "ranking-confirm") void refreshSongs();
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "连接失败，请刷新确认保存结果。");
      await load();
      return false;
    } finally { playerSaveLock.current = false; setSavingPlayer(false); }
  }
  async function openMatch(m: ClMatch) {
    void refreshSongs();
    if (canManage && manage) {
      setOpening(true);
      try {
        const r = await fetch(apiPath + "/matches/" + encodeURIComponent(m.id), { cache: "no-store" });
        const d = await r.json() as { error?: string; match: ClMatch; revision: number; pool: Song[]; designated: Song | null };
        if (!r.ok) throw Error(d.error);
        setEditorRevision(d.revision);
        setEditorPool(d.pool);
        setDesignated(d.designated);
        setSelected(d.match);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "打开失败。");
      } finally { setOpening(false); }
    } else setSelected(m);
  }
  async function signOut() {
    try {
      await logout();
      setManage(false);
      setSelected(null);
      setDesignated(null);
      setEditorPool([]);
      toast.success("已退出登录");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "退出失败，请重试。");
    }
  }

  const selected = selectedDraft && !(canManage && manage)
    ? tournament.matches.find(m => m.id === selectedDraft.id) ?? selectedDraft
    : selectedDraft;
  const live = tournament.matches.filter(m => m.status === "live").sort((a, b) => a.station.localeCompare(b.station));
  const completed = tournament.matches.filter(m => m.status === "complete" || m.status === "bye").length;
  const name = (id: string | null) => clPlayer(tournament, id)?.name;
  const matchScore = (m: ClMatch) => clDefinition(m.id).kind === "points" ? clPoints(m) : clTotals(m);
  const standings = clStandings(tournament);

  function matchCard(m: ClMatch) {
    const definition = clDefinition(m.id);
    const score = matchScore(m);
    return (
      <div className={s.matchSlot} key={m.id}>
        <button className={cn(s.matchCard, m.status === "live" && s.matchLive, m.id === "G14" && "border-[#d7b24a] bg-[#fffdf6]")} onClick={() => void openMatch(m)}
          aria-label={`${m.id} ${definition.title} ${name(m.a) ?? "待定"} 对 ${name(m.b) ?? "待定"}`}>
          <span className={s.matchMeta}>
            <span><b className="text-[#3a3a40] font-semibold">{m.id}</b> · {definition.title}</span>
            <span className={cn(s.matchStatus, m.status === "live" && "text-primary")}>{m.status === "live" ? <><i className={s.dot} />进行中 · {m.station} 台</> : m.status === "complete" ? "已结束" : m.status === "bye" ? "判定胜负" : "待开始"}</span>
          </span>
          {(["a", "b"] as const).map((side, i) => {
            const won = !!m.winner && m.winner === m[side];
            return (
            <span key={side} className={s.player}>
              <span className={s.seed}>{clSeed(tournament, m[side]) ?? "—"}</span>
              <span className={s.playerProfile}>
                <span className={cn(s.playerName, !m[side] && "text-[#a0a0a8] text-[12px]", won && s.winnerText, !won && m.status === "complete" && "text-[#797981]", won && m.status === "bye" && "after:content-['_↗'] after:text-[12px]")}>{name(m[side]) ?? sourceLabel(m.id, side)}</span>
              </span>
              <span className={cn(s.score, won && s.winnerText)}>{m.scores.length ? score[i].toLocaleString() : "—"}</span>
            </span>
            );
          })}
        </button>
      </div>
    );
  }

  return (
    <>
      {notice && <div className={cn("fixed top-4 left-1/2 [transform:translateX(-50%)] z-[100] max-w-[calc(100vw-32px)] py-2.5 px-4 rounded-[10px] text-[14px] shadow-[0_8px_24px_#00000018] bg-[#ecfdf3] text-[#067647] border border-[#abefc6]", notice.kind === "error" && "bg-[#fef3f2] text-[#b42318] border-[#fecdca]")} role={notice.kind === "error" ? "alert" : "status"}>{notice.text}</div>}
      <header className={s.topbar}>
        <div className={s.topbarInner}>
          <Link className={s.brand} href="/"><span className={s.brandIcon}><Drum size={24} /></span>CenturyLink<span className={s.edition}>世纪汇店赛</span></Link>
          <span className={s.localTag}>{demo ? "本地 Demo" : "第二届"}</span>
          <Link className={s.login} href={loginHref(pagePath + "?manage=1")} aria-label={user ? "账号" : "登录"}>
            <ShieldCheck size={16} /><span>{user ? user.name : "登录"}</span><ArrowUpRight size={15} />
          </Link>
        </div>
      </header>
      <main className={s.container}>
        <section className={s.eventHead}>
          <div>
            <span className={s.eventKicker}>OURTAIKO COMMUNITY TOURNAMENT</span>
            <h1 className={s.eventTitle}>第二届世纪汇单店赛<span className={s.editionNo}>/ 02</span></h1>
            <div className={s.eventDetails}>
              <span className={s.eventDetail}><CalendarDays size={16} />2026.12.27 · 周日</span>
              <span className={s.eventDetail}><MapPin size={16} />酷玩空间世纪汇店</span>
            </div>
          </div>
          <div className={s.eventFormat}>
            <span className={s.eventFormatItem}>8<span className={s.eventFormatLabel}>位选手</span></span>
            <span className={s.eventFormatItem}>3<span className={s.eventFormatLabel}>个阶段</span></span>
            <span className={s.eventFormatItem}>双败<span className={s.eventFormatLabel}>淘汰赛制</span></span>
          </div>
        </section>
        <div className={s.workspaceNav}>
          <Tabs value={view} onValueChange={setView} className={s.workspaceTabs}>
            <TabsList className={s.mainTabs} variant="line">
              <TabsTrigger className={s.mainTab} value="bracket"><GitBranch />赛程对阵</TabsTrigger>
              <TabsTrigger className={s.mainTab} value="ranking"><ListOrdered />排位赛</TabsTrigger>
              <TabsTrigger className={s.mainTab} value="songs"><Music2 />比赛曲库</TabsTrigger>
              <TabsTrigger className={s.mainTab} value="rules"><CalendarDays />赛事指南</TabsTrigger>
              <TabsTrigger className={s.mainTab} value="admin"><ShieldCheck />赛事管理</TabsTrigger>
            </TabsList>
          </Tabs>
          <span className={s.syncLabel}><span className={s.syncDot} />{connectionError ? "连接中断" : !loaded ? "正在同步" : "每 3 秒同步"}</span>
        </div>
        {connectionError && <div role="alert" className="mt-5 rounded-[10px] p-3.5 bg-[#fff1ef] text-[#ab332a] text-[14px]">{connectionError} <button className="ml-2.5 underline" onClick={() => void load()}>重新连接</button></div>}
        {canManage && view === "bracket" && (
          <div className="mt-[18px] py-3 px-4 flex items-center gap-[15px] bg-[#e8f1fc] rounded-[10px] text-[#275b95] text-[12px] mobile:text-[11px] mobile:gap-2 mobile:flex-wrap mobile:p-2.5">
            <span className="flex items-center gap-[7px] mobile:w-full"><ShieldCheck size={16} />{user?.demo ? "演示管理模式" : user?.name}</span>
            <button className="p-[5px] ml-auto mobile:ml-0" onClick={() => { setSelected(null); setManage(!manage); }}>
              {manage ? "正在管理 · 切换为观众" : "观众视图 · 切换为管理"}
            </button>
            <button className="p-[5px] mobile:ml-auto" onClick={() => void signOut()}>退出</button>
          </div>
        )}
        {opening && <div className="fixed z-40 top-20 left-1/2 [transform:translateX(-50%)] py-3.5 px-[22px] rounded-[12px] bg-white shadow-[0_4px_18px_#00000010] text-[14px]" role="status">正在打开比赛…</div>}

        {view === "bracket" && <>
          <section className="mt-7">
            <div className={s.sectionHeading}>
              <h2 className={s.sectionTitle}><Radio size={19} />正在进行<span className={s.count}>{live.length}</span></h2>
              <span className={s.sectionNote}>{canManage && manage ? "点击比赛录分 / 管理" : "点击比赛查看详情"}</span>
            </div>
            {live.length ? <div className="grid grid-cols-2 gap-[18px] mobile:gap-3">{live.map(m => {
              const score = matchScore(m);
              return (
                <button className="border border-[#d6e5fa] bg-white rounded-[18px] text-left overflow-hidden shadow-[0_3px_12px_#00000003] hover:border-[#93b9e6] mobile:rounded-[14px]" onClick={() => void openMatch(m)} key={m.id}>
                  <div className="py-[17px] px-[22px] flex justify-between items-center text-[12px] mobile:p-3">
                    <span className="flex gap-[7px] items-center text-primary font-semibold text-[11px] tracking-[1px] mobile:text-[9px] mobile:tracking-[0.4px]"><i className={s.dot} />LIVE · {m.station} 台</span>
                    <span className="flex gap-[5px] text-[#74747d] items-center mobile:text-[9px] mobile:[&_svg]:hidden">{m.id} · {clDefinition(m.id).title}<ChevronRight size={16} /></span>
                  </div>
                  <div className="mx-[22px] mb-1.5 text-[#505866] text-[12px] font-semibold mobile:mx-3 mobile:text-[11px]">{clStages[m.round - 1].name}</div>
                  <div className="grid grid-cols-[1fr_44px_1fr] items-center text-center pt-2.5 px-[18px] pb-[25px] mobile:grid-cols-[1fr_20px_1fr] mobile:pt-2 mobile:px-2 mobile:pb-4">
                    <div className="min-w-0">
                      <span className={avatar}>{name(m.a)?.slice(0, 1).toUpperCase()}</span>
                      <b className={versusName}>{name(m.a)}</b>
                      <span className={liveTotal}>{score[0].toLocaleString()}</span>
                    </div>
                    <span className="text-[12px] text-[#a5a5ae] font-[550] mobile:text-[9px]">VS</span>
                    <div className="min-w-0">
                      <span className={avatar}>{name(m.b)?.slice(0, 1).toUpperCase()}</span>
                      <b className={versusName}>{name(m.b)}</b>
                      <span className={liveTotal}>{score[1].toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center py-3 px-[22px] border-t border-[#f1f1f4] text-[12px] text-[#6e6e73] [&_svg]:text-[#92929b] mobile:py-2.5 mobile:px-3 mobile:text-[10px] mobile:gap-[5px]">
                    <Music2 size={15} />
                    <span className="mobile:overflow-hidden mobile:text-ellipsis mobile:whitespace-nowrap">{clSongName(m.scores.find(s => s.a === null || s.b === null)?.songId ?? m.scores.at(-1)?.songId ?? "", catalog)}</span>
                    <span className="ml-auto whitespace-nowrap mobile:hidden mobile:overflow-hidden mobile:text-ellipsis">{m.scores.filter(s => s.a !== null && s.b !== null).length} / {m.scores.length} 首已录分</span>
                  </div>
                </button>
              );
            })}</div> : <div className={s.emptyLive}><Radio size={23} /><span>暂无进行中的比赛</span><small className="text-[12px]">开赛后，赛况将在这里同步。</small></div>}
          </section>
          <section className={s.bracketSection}>
            <div className={s.sectionHeading}>
              <h2 className={s.sectionTitle}>晋级之路</h2>
              <span className={s.sectionNote}>已完成 {completed} / {clBracket.length} 场</span>
            </div>
            {tournament.ranking.status !== "complete" && loaded && (
              <p className="-mt-1 mb-[18px] text-[#6e6e73] text-[13px]">排位赛确认后生成首轮对阵：1 号对 8 号、2 号对 7 号、3 号对 6 号、4 号对 5 号。</p>
            )}
            <Tabs value={String(stage)} onValueChange={v => setStage(Number(v) as ClStage)} className={s.mobileRounds}>
              <TabsList className={s.mobileRoundsList}>{clStages.map(st => <TabsTrigger key={st.round} value={String(st.round)} className={s.mobileRoundsTab}>{st.name}</TabsTrigger>)}</TabsList>
            </Tabs>
            <div className="flex flex-col gap-[22px]">
              {clStages.map(st => (
                <section key={st.round} className={cn("bg-white border border-line rounded-[18px] pt-5 px-[22px] pb-[22px] mobile:hidden mobile:p-4 mobile:rounded-[16px]", stage === st.round && "mobile:block")} aria-label={st.name}>
                  <header className="flex items-baseline justify-between gap-3 mb-4 flex-wrap">
                    <h3 className="m-0 text-[17px] flex items-baseline gap-2">{st.name}<small className="text-[#8a8a93] text-[12px] font-medium">{st.en}</small></h3>
                    <span className="text-[#7a7a82] text-[12px]">{st.summary} · 曲库 {st.pool}</span>
                  </header>
                  <div className={cn("grid gap-[18px] [align-items:start] mobile:grid-cols-[1fr]", stageColumns[st.round].length === 2 ? "grid-cols-[2fr_1fr]" : "grid-cols-3")}>
                    {stageColumns[st.round].map((column, index) => (
                      <div key={column.title}>
                        <div className={cn(s.roundTitle, "flex-col items-start gap-0.5")}><span className="font-semibold text-[#3a3a40]">{column.title}</span><small className={s.roundTitleNote}>{column.note}</small></div>
                        <div className={stageColumns[st.round].length === 2 && index === 0 ? "grid flex-col grid-cols-2 gap-3 mobile:grid-cols-[1fr]" : "flex flex-col gap-3"}>
                          {column.ids.map(id => matchCard(tournament.matches.find(m => m.id === id) ?? initial.matches.find(m => m.id === id)!))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            <div className={s.bracketLegend}>
              <span className={s.legendItem}><i className={cn(s.dot, "bg-primary")} />进行中</span>
              <span className={s.legendItem}><i className={cn(s.dot, "bg-[#a4a4af]")} />已结束</span>
              <span className={s.legendNote}>双败淘汰 · 累计落败 2 次淘汰 · 第三阶段为抢 3 分制</span>
            </div>
          </section>
          <section className="mt-[30px]" aria-label="最终排名">
            <div className={s.sectionHeading}><h2 className={s.sectionTitle}><Medal size={19} />最终排名</h2><span className={s.sectionNote}>随比赛结果自动更新</span></div>
            <ol className="list-none p-0 m-0 grid grid-cols-4 gap-2.5 mobile:grid-cols-2">{standings.map((row, i) => (
              <li key={i} className="flex items-center gap-2.5 bg-white border border-line rounded-[12px] py-3 px-3.5 text-[14px] min-w-0">
                <span className="text-[11px] text-[#7a7a82] whitespace-nowrap">{row.place}</span>
                <b className={cn("overflow-hidden text-ellipsis whitespace-nowrap text-[#a0a0a8] font-medium", row.playerId && "text-foreground font-semibold")}>{name(row.playerId) ?? "待定"}</b>
                {i === 0 && row.playerId && <Trophy size={16} className="text-[#c79a1c] ml-auto shrink-0" />}
              </li>
            ))}</ol>
          </section>
        </>}

        {view === "ranking" && (
          <section>
            <div className={s.sectionHeading}>
              <h2 className={s.sectionTitle}>排位赛</h2>
              <span className={s.sectionNote}>{tournament.ranking.status === "complete" ? "排位已确认" : tournament.ranking.status === "live" ? "进行中" : "尚未开始"}</span>
            </div>
            <p className={s.songNote}>所有进入正赛的选手单独游玩一首指定曲，按得分从高到低确定正赛顺位。</p>
            <div className={cn(s.designated, "m-0 mb-[18px]")}>
              <Music2 size={22} />
              <div>
                <h3 className={s.designatedTitle}>排位赛指定曲</h3>
                <p className={s.designatedText}>{clSongName(clSpecialId("ranking"), catalog)}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {(tournament.ranking.status === "complete"
                ? tournament.ranking.seeds.map(id => clPlayer(tournament, id)!)
                : [...tournament.players].sort((a, b) => (b.rankingScore ?? -1) - (a.rankingScore ?? -1))
              ).map((p, i) => (
                <div className={s.songRow} key={p.id}>
                  <span className={s.songIndex}>{tournament.ranking.status === "complete" ? `#${i + 1}` : p.rankingScore === null ? "—" : String(i + 1).padStart(2, "0")}</span>
                  <span className={s.songTitle}>{p.name}</span>
                  <span className={s.stars}>{p.rankingScore?.toLocaleString() ?? "待录入"}</span>
                </div>
              ))}
              {loaded && !tournament.players.length && <div className={s.emptyLive}><span>正赛选手尚未确定</span><small className="text-[12px]">海选赛与 Last Chance 结束后公布。</small></div>}
            </div>
          </section>
        )}

        {view === "songs" && (
          <section>
            <div className={s.sectionHeading}><h2 className={s.sectionTitle}>比赛曲库</h2><span className={s.sectionNote}>共 32 首 · 各阶段曲库有重叠</span></div>
            <p className={s.songNote} role="status">{songNotice || "曲名与星级来自 OurTaiko，每 30 秒自动更新。"}</p>
            {clStages.map(st => (
              <div key={st.round} className="mt-[26px]">
                <h3 className={poolTitle}>{st.name}<small className={poolNote}>{st.pool}</small></h3>
                <div className={s.songList}>
                  {pools[st.round].map(id => {
                    const song = catalog[id];
                    return (
                      <div className={s.songRow} key={id}>
                        <span className={s.songIndex}>{String(clSongNumber(id)).padStart(2, "0")}</span>
                        <Music2 size={20} className={s.songIcon} />
                        <span className={s.songTitle}>{song
                          ? <a className={songLink} href={songWikiUrl(song.songID)} target="_blank" rel="noreferrer">{song.title}</a>
                          : "曲目信息加载中"}{song && song.difficultyIndex !== 4 && <small className={s.songTag}>{difficultyNames[song.difficultyIndex]}</small>}</span>
                        <span className={s.stars}>★ {song?.stars ?? "—"}</span>
                      </div>
                    );
                  })}
                  {!pools[st.round].length && <p className={s.muted}>曲库加载中…</p>}
                </div>
              </div>
            ))}
            <div className="mt-[26px]">
              <h3 className={poolTitle}>指定曲与决胜曲</h3>
              <div className={s.songList}>
                {clDesignatedKeys.map(key => (
                  <div className={s.songRow} key={key}>
                    <span className={s.songIndex}><Trophy size={15} /></span>
                    <span className={s.songTitle}>{clDesignatedLabels[key]}<small className={s.songTag}>{catalog[clSpecialId(key)]
                      ? <a className={songLink} href={songWikiUrl(catalog[clSpecialId(key)].songID)} target="_blank" rel="noreferrer">{clSongName(clSpecialId(key), catalog)}</a>
                      : "曲目信息加载中"}</small></span>
                    <span className={s.stars}>{catalog[clSpecialId(key)] ? `★ ${catalog[clSpecialId(key)].stars ?? "—"}` : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {view === "rules" && (
          <section className={s.rules}>
            <h2 className={s.rulesTitle}>12 月 27 日，世纪汇见。</h2>
            <p className={s.rulesLede}>正赛采用双败淘汰制，累计落败 2 次的选手淘汰。全程乐曲选项只能更改「调整音符位置」与「语音」。</p>
            <div className={s.ruleGrid}>
              <article className={s.ruleCard}>
                <span className={s.ruleNo}>00</span>
                <h3 className={s.ruleTitle}>排位赛</h3>
                <p className={s.ruleText}>进入正赛的 8 位选手单独游玩一首指定曲，按得分排定 1–8 号顺位；首轮 1v8、2v7、3v6、4v5。</p>
              </article>
              <article className={s.ruleCard}>
                <span className={s.ruleNo}>01</span>
                <h3 className={s.ruleTitle}>第一阶段 · 8 进 6</h3>
                <p className={s.ruleText}>曲库为曲 1–10。首轮与 0-1 组均由高顺位先禁用 1 首、低顺位后禁用 1 首，再依次各选 1 首，比较两首总分。首轮败者进入 0-1 组，0-1 组负者获得第 7、8 名。</p>
              </article>
              <article className={s.ruleCard}>
                <span className={s.ruleNo}>02</span>
                <h3 className={s.ruleTitle}>第二阶段 · 6 进 3</h3>
                <p className={s.ruleText}>曲库为曲 5–18。双方各禁用 1 首、各选 1 首，再演奏 1 首指定曲，比较三首总分。1-0 组胜者进入胜者组决赛；1-1 组负者获得第 5、6 名，胜者之间再赛一场，负者获得第 4 名。</p>
              </article>
              <article className={s.ruleCard}>
                <span className={s.ruleNo}>03</span>
                <h3 className={s.ruleTitle}>决赛阶段 · 抢 3 分</h3>
                <p className={s.ruleText}>曲库为曲 19–32。双方轮流各禁用 1 首，总决赛中胜者组冠军可再禁用 1 首。主办方每次随机抽取 1 首，可连续逐首抽完后再比赛，最多抽 4 首。每首得分高者得 1 分，先得 3 分者获胜；2:2 时演奏决胜曲。</p>
              </article>
              <article className={s.ruleCard}>
                <span className={s.ruleNo}>04</span>
                <h3 className={s.ruleTitle}>换边与演奏顺序</h3>
                <p className={s.ruleText}>每场通过猜硬币决定选边与演奏顺序，每首结束后双方换边。同一阶段内，一名选手不能多次游玩同一首曲目（指定曲除外）。</p>
              </article>
              <article className={s.ruleCard}>
                <span className={s.ruleNo}>05</span>
                <h3 className={s.ruleTitle}>同分加赛</h3>
                <p className={s.ruleText}>同分影响晋级或总比分持平时，从对应曲库额外抽取一首加赛，直至分出胜负。禁用只在本场有效。</p>
              </article>
            </div>
          </section>
        )}

        {view === "admin" && (
          <section className="py-[55px] px-[25px] text-center bg-white rounded-[18px] flex items-center flex-col gap-4 mobile:py-[35px] mobile:px-[22px]">
            <ShieldCheck size={34} className="text-primary" />
            <h2>赛事管理</h2>
            {sessionLoading ? <p role="status" className={s.adminText}>正在验证登录状态…</p> : sessionError ? <>
              <p role="alert" className={s.adminText}>{sessionError}</p>
              <button className={s.secondaryButton} onClick={() => void loadSession()}>重新验证</button>
            </> : canManage ? <>
              <p className={s.adminText}>{user?.name}，欢迎回来。在这里录入选手昵称与排位赛分数；Ban 曲、选曲和录分请在「赛程对阵」中打开对应比赛。</p>
              <div className="flex flex-wrap justify-center gap-3">
                <button className={s.primaryButton} onClick={() => { setManage(true); setView("bracket"); }}>前往比赛管理 <ChevronRight size={16} /></button>
                <button className={s.secondaryButton} onClick={() => void signOut()}>退出登录</button>
              </div>
              {demo && <p className={cn(s.adminText, s.muted)}>本地演示模式中的操作只影响演示赛况。</p>}
            </> : <>
              <p className={s.adminText}>{user ? "此账号暂无赛事管理权限，请联系主办方授权。" : "赛事管理仅向已获主办方授权的账号开放。"}</p>
              <a className={s.primaryButton} href={loginHref(pagePath + "?manage=1")}>{user ? "查看账号" : "前往登录"} <ArrowUpRight size={16} /></a>
            </>}
            {canManage && <ClPlayerManager tournament={tournament} disabled={!loaded || !!connectionError || savingPlayer} onSave={savePlayers} />}
            {canManage && <ClRankingManager tournament={tournament} disabled={!loaded || !!connectionError || savingPlayer} onSave={savePlayers} />}
            {canManage && <ResetTournament<CenturyLink>
              tournamentId={tournamentId}
              revision={tournament.revision}
              demo={demo}
              disabled={!loaded || !!connectionError}
              title={demo ? "演示赛事维护" : "第二届赛事维护"}
              summary="清空排位赛分数、顺位及全部 14 场比赛，恢复为待开始。请勿在正式比赛进行中使用。"
              buttonLabel={demo ? "重置演示赛事" : "重置第二届赛事"}
              dialogTitle={demo ? "重置演示赛事？" : "重置第二届世纪汇单店赛？"}
              dialogDescription="这会清空排位赛分数与顺位，以及全部比赛的 Ban 曲、选曲、比分和晋级结果。选手名单、曲库和管理员设置保持不变。"
              onReset={next => {
                setSelected(null);
                setDesignated(null);
                setTournament(previous => next.revision >= previous.revision ? next : previous);
                setStage(1);
                setView("bracket");
                toast.success("赛事已重置，重置前的赛况已自动备份。");
                void load();
              }}
            />}
          </section>
        )}
        <footer className={s.footer}>
          <span className={s.footerBrand}><Drum size={17} />CenturyLink · 第二届世纪汇单店赛</span>
          <span>{demo ? "曲库与选手为演示数据" : "赛况自动同步"}</span>
        </footer>
      </main>
      <Sheet open={!!selected} onOpenChange={v => !v && setSelected(null)}>
        <SheetContent className={s.matchSheet}>
          <SheetHeader className={s.sheetHeader}>
            <SheetTitle className={s.sheetTitle}>比赛详情</SheetTitle>
            <SheetDescription className={s.sheetDescription}>{selected && `${clStages[selected.round - 1].name} · ${selected.id} · ${clDefinition(selected.id).title}`}</SheetDescription>
          </SheetHeader>
          {selected && (
            <div className={s.sheetBody}>
              <div className={s.contestants}>
                {(["a", "b"] as const).map(side => (
                  <div key={side} className={side === "b" ? "col-start-3" : undefined}>
                    <h2 className={s.contestantName}>{name(selected[side]) ?? "待定"}</h2>
                    <span className={s.playerRating}>{clSeed(tournament, selected[side]) ? `排位 #${clSeed(tournament, selected[side])}` : sourceLabel(selected.id, side)}</span>
                  </div>
                ))}
                <span className={s.contestantsVs}>VS</span>
              </div>
              <p className={s.ratingSource}>{clDefinition(selected.id).eliminates ? `本场败者获得${clDefinition(selected.id).eliminates}` : selected.id === "G12" ? "本场败者进入败者组决赛" : "本场败者进入败者组"}</p>
              {canManage && manage ? (
                <ClMatchEditor
                  key={selected.id + "-" + editorRevision}
                  tournamentId={tournamentId}
                  tournament={tournament}
                  match={selected}
                  revision={editorRevision}
                  pool={editorPool}
                  designated={designated}
                  catalog={catalog}
                  disabled={!loaded || !!connectionError}
                  onSaved={(m, r) => {
                    const confirmed = m.status === "complete" || m.status === "bye";
                    setSelected(confirmed ? null : m);
                    setEditorRevision(r);
                    void load();
                    void refreshSongs();
                    toast.success(confirmed ? "结果已确认，对阵图已更新" : "已保存");
                  }}
                />
              ) : <ClMatchSummary tournament={tournament} match={selected} catalog={catalog} />}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
