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
      <div className="match-slot" key={m.id}>
        <button className={`match ${m.status} ${m.id === "G14" ? "cl-grand" : ""}`} onClick={() => void openMatch(m)}
          aria-label={`${m.id} ${definition.title} ${name(m.a) ?? "待定"} 对 ${name(m.b) ?? "待定"}`}>
          <span className="match-meta">
            <span><b className="cl-match-no">{m.id}</b> · {definition.title}</span>
            <span>{m.status === "live" ? <><i />进行中 · {m.station} 台</> : m.status === "complete" ? "已结束" : m.status === "bye" ? "判定胜负" : "待开始"}</span>
          </span>
          {(["a", "b"] as const).map((side, i) => (
            <span key={side} className={`player ${m.winner && m.winner === m[side] ? "winner" : ""}`}>
              <span className="seed">{clSeed(tournament, m[side]) ?? "—"}</span>
              <span className="player-profile">
                <span className={`player-name ${m[side] ? "" : "cl-pending-slot"}`}>{name(m[side]) ?? sourceLabel(m.id, side)}</span>
              </span>
              <span className="score">{m.scores.length ? score[i].toLocaleString() : "—"}</span>
            </span>
          ))}
        </button>
      </div>
    );
  }

  return (
    <>
      {notice && <div className={`cl-toast ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>{notice.text}</div>}
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" href="/"><span className="brand-icon"><Drum size={24} /></span>CenturyLink<span className="edition">世纪汇店赛</span></Link>
          <span className="local-tag">{demo ? "本地 Demo" : "第二届"}</span>
          <Link className="login" href={loginHref(pagePath + "?manage=1")} aria-label={user ? "账号" : "登录"}>
            <ShieldCheck size={16} /><span>{user ? user.name : "登录"}</span><ArrowUpRight size={15} />
          </Link>
        </div>
      </header>
      <main className="container">
        <section className="event-head">
          <div>
            <span className="event-kicker">OURTAIKO COMMUNITY TOURNAMENT</span>
            <h1>第二届世纪汇单店赛<span className="edition-no">/ 02</span></h1>
            <div className="event-details">
              <span><CalendarDays size={16} />2026.12.27 · 周日</span>
              <span><MapPin size={16} />酷玩空间世纪汇店</span>
            </div>
          </div>
          <div className="event-format">
            <span>8<span>位选手</span></span>
            <span>3<span>个阶段</span></span>
            <span>双败<span>淘汰赛制</span></span>
          </div>
        </section>
        <div className="workspace-nav">
          <Tabs value={view} onValueChange={setView}>
            <TabsList className="main-tabs" variant="line">
              <TabsTrigger value="bracket"><GitBranch />赛程对阵</TabsTrigger>
              <TabsTrigger value="ranking"><ListOrdered />排位赛</TabsTrigger>
              <TabsTrigger value="songs"><Music2 />比赛曲库</TabsTrigger>
              <TabsTrigger value="rules"><CalendarDays />赛事指南</TabsTrigger>
              <TabsTrigger value="admin"><ShieldCheck />赛事管理</TabsTrigger>
            </TabsList>
          </Tabs>
          <span className="sync-label"><span className="sync-dot" />{connectionError ? "连接中断" : !loaded ? "正在同步" : "每 3 秒同步"}</span>
        </div>
        {connectionError && <div role="alert" className="connection-error">{connectionError} <button onClick={() => void load()}>重新连接</button></div>}
        {canManage && view === "bracket" && (
          <div className="management-bar">
            <span><ShieldCheck size={16} />{user?.demo ? "演示管理模式" : user?.name}</span>
            <button className={manage ? "active" : ""} onClick={() => { setSelected(null); setManage(!manage); }}>
              {manage ? "正在管理 · 切换为观众" : "观众视图 · 切换为管理"}
            </button>
            <button onClick={() => void signOut()}>退出</button>
          </div>
        )}
        {opening && <div className="loading-match" role="status">正在打开比赛…</div>}

        {view === "bracket" && <>
          <section className="live-section">
            <div className="section-heading">
              <h2><Radio size={19} />正在进行<span className="count">{live.length}</span></h2>
              <span>{canManage && manage ? "点击比赛录分 / 管理" : "点击比赛查看详情"}</span>
            </div>
            {live.length ? <div className="live-grid">{live.map(m => {
              const score = matchScore(m);
              return (
                <button className="live-card" onClick={() => void openMatch(m)} key={m.id}>
                  <div className="live-card-head">
                    <span className="live-label"><i />LIVE · {m.station} 台</span>
                    <span>{m.id} · {clDefinition(m.id).title}<ChevronRight size={16} /></span>
                  </div>
                  <div className="live-card-group">{clStages[m.round - 1].name}</div>
                  <div className="versus">
                    <div>
                      <span className="avatar">{name(m.a)?.slice(0, 1).toUpperCase()}</span>
                      <b>{name(m.a)}</b>
                      <span className="live-total">{score[0].toLocaleString()}</span>
                    </div>
                    <span className="versus-word">VS</span>
                    <div>
                      <span className="avatar">{name(m.b)?.slice(0, 1).toUpperCase()}</span>
                      <b>{name(m.b)}</b>
                      <span className="live-total">{score[1].toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="live-card-foot">
                    <Music2 size={15} />
                    <span>{clSongName(m.scores.find(s => s.a === null || s.b === null)?.songId ?? m.scores.at(-1)?.songId ?? "", catalog)}</span>
                    <span>{m.scores.filter(s => s.a !== null && s.b !== null).length} / {m.scores.length} 首已录分</span>
                  </div>
                </button>
              );
            })}</div> : <div className="empty-live"><Radio size={23} /><span>暂无进行中的比赛</span><small>开赛后，赛况将在这里同步。</small></div>}
          </section>
          <section className="bracket-section">
            <div className="section-heading">
              <h2>晋级之路</h2>
              <span>已完成 {completed} / {clBracket.length} 场</span>
            </div>
            {tournament.ranking.status !== "complete" && loaded && (
              <p className="cl-bracket-note">排位赛确认后生成首轮对阵：1 号对 8 号、2 号对 7 号、3 号对 6 号、4 号对 5 号。</p>
            )}
            <Tabs value={String(stage)} onValueChange={v => setStage(Number(v) as ClStage)} className="mobile-rounds">
              <TabsList>{clStages.map(s => <TabsTrigger key={s.round} value={String(s.round)}>{s.name}</TabsTrigger>)}</TabsList>
            </Tabs>
            <div className="cl-stages">
              {clStages.map(s => (
                <section key={s.round} className={`cl-stage ${stage === s.round ? "visible-round" : ""}`} aria-label={s.name}>
                  <header className="cl-stage-head">
                    <h3>{s.name}<small>{s.en}</small></h3>
                    <span>{s.summary} · 曲库 {s.pool}</span>
                  </header>
                  <div className={`cl-stage-columns cl-columns-${stageColumns[s.round].length}`}>
                    {stageColumns[s.round].map(column => (
                      <div className="cl-column" key={column.title}>
                        <div className="round-title cl-column-title"><span>{column.title}</span><small>{column.note}</small></div>
                        <div className="cl-column-matches">
                          {column.ids.map(id => matchCard(tournament.matches.find(m => m.id === id) ?? initial.matches.find(m => m.id === id)!))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            <div className="bracket-legend">
              <span><i className="legend-live" />进行中</span>
              <span><i className="legend-done" />已结束</span>
              <span>双败淘汰 · 累计落败 2 次淘汰 · 第三阶段为抢 3 分制</span>
            </div>
          </section>
          <section className="cl-standings" aria-label="最终排名">
            <div className="section-heading"><h2><Medal size={19} />最终排名</h2><span>随比赛结果自动更新</span></div>
            <ol>{standings.map((row, i) => (
              <li key={i} className={row.playerId ? "decided" : ""}>
                <span className="cl-place">{row.place}</span>
                <b>{name(row.playerId) ?? "待定"}</b>
                {i === 0 && row.playerId && <Trophy size={16} />}
              </li>
            ))}</ol>
          </section>
        </>}

        {view === "ranking" && (
          <section className="cl-ranking">
            <div className="section-heading">
              <h2>排位赛</h2>
              <span>{tournament.ranking.status === "complete" ? "排位已确认" : tournament.ranking.status === "live" ? "进行中" : "尚未开始"}</span>
            </div>
            <p className="song-sync-note">所有进入正赛的选手单独游玩一首指定曲，按得分从高到低确定正赛顺位。</p>
            <div className="designated">
              <Music2 size={22} />
              <div>
                <h3>排位赛指定曲</h3>
                <p>{clSongName(clSpecialId("ranking"), catalog)}</p>
              </div>
            </div>
            <div className="cl-ranking-table">
              {(tournament.ranking.status === "complete"
                ? tournament.ranking.seeds.map(id => clPlayer(tournament, id)!)
                : [...tournament.players].sort((a, b) => (b.rankingScore ?? -1) - (a.rankingScore ?? -1))
              ).map((p, i) => (
                <div className="song-row" key={p.id}>
                  <span className="song-index">{tournament.ranking.status === "complete" ? `#${i + 1}` : p.rankingScore === null ? "—" : String(i + 1).padStart(2, "0")}</span>
                  <span className="song-title">{p.name}</span>
                  <span className="stars">{p.rankingScore?.toLocaleString() ?? "待录入"}</span>
                </div>
              ))}
              {loaded && !tournament.players.length && <div className="empty-live"><span>正赛选手尚未确定</span><small>海选赛与 Last Chance 结束后公布。</small></div>}
            </div>
          </section>
        )}

        {view === "songs" && (
          <section className="song-section">
            <div className="section-heading"><h2>比赛曲库</h2><span>共 32 首 · 各阶段曲库有重叠</span></div>
            <p className="song-sync-note" role="status">{songNotice || "曲名与星级来自 OurTaiko，每 30 秒自动更新。"}</p>
            {clStages.map(s => (
              <div key={s.round} className="cl-pool">
                <h3>{s.name}<small>{s.pool}</small></h3>
                <div className="song-list">
                  {pools[s.round].map(id => {
                    const song = catalog[id];
                    return (
                      <div className="song-row" key={id}>
                        <span className="song-index">{String(clSongNumber(id)).padStart(2, "0")}</span>
                        <Music2 size={20} />
                        <span className="song-title">{song
                          ? <a className="cl-song-link" href={songWikiUrl(song.songID)} target="_blank" rel="noreferrer">{song.title}</a>
                          : "曲目信息加载中"}{song && song.difficultyIndex !== 4 && <small>{difficultyNames[song.difficultyIndex]}</small>}</span>
                        <span className="stars">★ {song?.stars ?? "—"}</span>
                      </div>
                    );
                  })}
                  {!pools[s.round].length && <p className="muted">曲库加载中…</p>}
                </div>
              </div>
            ))}
            <div className="cl-pool">
              <h3>指定曲与决胜曲</h3>
              <div className="song-list">
                {clDesignatedKeys.map(key => (
                  <div className="song-row" key={key}>
                    <span className="song-index"><Trophy size={15} /></span>
                    <span className="song-title">{clDesignatedLabels[key]}<small>{catalog[clSpecialId(key)]
                      ? <a className="cl-song-link" href={songWikiUrl(catalog[clSpecialId(key)].songID)} target="_blank" rel="noreferrer">{clSongName(clSpecialId(key), catalog)}</a>
                      : "曲目信息加载中"}</small></span>
                    <span className="stars">{catalog[clSpecialId(key)] ? `★ ${catalog[clSpecialId(key)].stars ?? "—"}` : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {view === "rules" && (
          <section className="rules">
            <h2>12 月 27 日，世纪汇见。</h2>
            <p>正赛采用双败淘汰制，累计落败 2 次的选手淘汰。全程乐曲选项只能更改「调整音符位置」与「语音」。</p>
            <div className="rule-grid">
              <article>
                <span>00</span>
                <h3>排位赛</h3>
                <p>进入正赛的 8 位选手单独游玩一首指定曲，按得分排定 1–8 号顺位；首轮 1v8、2v7、3v6、4v5。</p>
              </article>
              <article>
                <span>01</span>
                <h3>第一阶段 · 8 进 6</h3>
                <p>曲库为曲 1–10。首轮与 0-1 组均由高顺位先禁用 1 首、低顺位后禁用 1 首，再依次各选 1 首，比较两首总分。首轮败者进入 0-1 组，0-1 组负者获得第 7、8 名。</p>
              </article>
              <article>
                <span>02</span>
                <h3>第二阶段 · 6 进 3</h3>
                <p>曲库为曲 5–18。双方各禁用 1 首、各选 1 首，再演奏 1 首指定曲，比较三首总分。1-0 组胜者进入胜者组决赛；1-1 组负者获得第 5、6 名，胜者之间再赛一场，负者获得第 4 名。</p>
              </article>
              <article>
                <span>03</span>
                <h3>决赛阶段 · 抢 3 分</h3>
                <p>曲库为曲 19–32。双方轮流各禁用 1 首，总决赛中胜者组冠军可再禁用 1 首。主办方每次随机抽取 1 首，录完双方成绩后再抽下一首，最多抽 4 首。每首得分高者得 1 分，先得 3 分者获胜；2:2 时演奏决胜曲。</p>
              </article>
              <article>
                <span>04</span>
                <h3>换边与演奏顺序</h3>
                <p>每场通过猜硬币决定选边与演奏顺序，每首结束后双方换边。同一阶段内，一名选手不能多次游玩同一首曲目（指定曲除外）。</p>
              </article>
              <article>
                <span>05</span>
                <h3>同分加赛</h3>
                <p>同分影响晋级或总比分持平时，从对应曲库额外抽取一首加赛，直至分出胜负。禁用只在本场有效。</p>
              </article>
            </div>
          </section>
        )}

        {view === "admin" && (
          <section className="admin-welcome">
            <ShieldCheck size={34} />
            <h2>赛事管理</h2>
            {sessionLoading ? <p role="status">正在验证登录状态…</p> : sessionError ? <>
              <p role="alert">{sessionError}</p>
              <button className="secondary-button" onClick={() => void loadSession()}>重新验证</button>
            </> : canManage ? <>
              <p>{user?.name}，欢迎回来。在这里录入选手昵称与排位赛分数；Ban 曲、选曲和录分请在「赛程对阵」中打开对应比赛。</p>
              <div className="admin-actions">
                <button className="primary-button" onClick={() => { setManage(true); setView("bracket"); }}>前往比赛管理 <ChevronRight size={16} /></button>
                <button className="secondary-button" onClick={() => void signOut()}>退出登录</button>
              </div>
              {demo && <p className="muted">本地演示模式中的操作只影响演示赛况。</p>}
            </> : <>
              <p>{user ? "此账号暂无赛事管理权限，请联系主办方授权。" : "赛事管理仅向已获主办方授权的账号开放。"}</p>
              <a className="primary-button" href={loginHref(pagePath + "?manage=1")}>{user ? "查看账号" : "前往登录"} <ArrowUpRight size={16} /></a>
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
        <footer>
          <span><Drum size={17} />CenturyLink · 第二届世纪汇单店赛</span>
          <span>{demo ? "曲库与选手为演示数据" : "赛况自动同步"}</span>
        </footer>
      </main>
      <Sheet open={!!selected} onOpenChange={v => !v && setSelected(null)}>
        <SheetContent className="match-sheet">
          <SheetHeader>
            <SheetTitle>比赛详情</SheetTitle>
            <SheetDescription>{selected && `${clStages[selected.round - 1].name} · ${selected.id} · ${clDefinition(selected.id).title}`}</SheetDescription>
          </SheetHeader>
          {selected && (
            <div className="sheet-body">
              <div className="match-contestants">
                {(["a", "b"] as const).map(side => (
                  <div key={side}>
                    <h2>{name(selected[side]) ?? "待定"}</h2>
                    <span className="player-rating">{clSeed(tournament, selected[side]) ? `排位 #${clSeed(tournament, selected[side])}` : sourceLabel(selected.id, side)}</span>
                  </div>
                ))}
                <span className="contestants-vs">VS</span>
              </div>
              <p className="rating-source">{clDefinition(selected.id).eliminates ? `本场败者获得${clDefinition(selected.id).eliminates}` : selected.id === "G12" ? "本场败者进入败者组决赛" : "本场败者进入败者组"}</p>
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
