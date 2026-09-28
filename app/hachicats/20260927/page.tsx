"use client";
import Link from "next/link";
import { HACHICATS_TOURNAMENT_ID, tournamentApiPath } from "@/lib/tournaments";
import { useTournamentAccess } from "@/components/auth/use-tournament-access";
import { useSSO } from "@/components/auth/sso-context";
import { loginHref } from "@/lib/auth-navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Cat,
  ChevronRight,
  Radio,
  CalendarDays,
  MapPin,
  Trophy,
  ArrowUpRight,
  Music2,
  GitBranch,
  ShieldCheck,
  Flag,
  ChartNoAxesColumn,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetHeader,
} from "@/components/ui/sheet";
import MatchEditor from "@/components/match-editor";
import MatchSummary from "@/components/match-summary";
import TournamentSummary, { TournamentChampions } from "@/components/tournament-summary";
import ResetTournament from "@/components/reset-tournament";
import PlayerManager from "@/components/player-manager";
import { reserves, type PlayerAction } from "@/lib/player-management";
import PlayerRating from "@/components/player-rating";
import { useSongCatalog } from "@/components/use-song-catalog";
import { difficultyNames, type Song } from "@/lib/songs";
import { toast, Toaster } from "sonner";
import type { Viewer } from "@/lib/auth";
import {
  groups,
  roundNames,
  firstAttack,
  totals,
  songName,
  type GroupId,
  type Match,
  type Tournament,
} from "@/lib/tournament";
const tournamentId = HACHICATS_TOURNAMENT_ID;
const apiPath = tournamentApiPath(tournamentId);
const initial: Tournament = { revision: 0, updatedAt: "", matches: [], rosters: { siamese: [], tabby: [], ragdoll: [] } };
export default function Home() {
  const { catalog, pools, notice: songNotice, refresh: refreshSongs } = useSongCatalog(tournamentId);
  const displaySongName = (group: GroupId, id: string) => songName(group, id, catalog);
  const [group, setGroup] = useState<GroupId>("siamese");
  const [view, setView] = useState("summary");
  const [round, setRound] = useState(0);
  const [selectedDraft, setSelected] = useState<Match | null>(null);
  const [tournament, setTournament] = useState<Tournament>(initial);
  const [loaded, setLoaded] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const { user, logout } = useSSO();
  const { canManage, loading: sessionLoading, error: sessionError, refresh: loadSession } = useTournamentAccess(tournamentId);
  const sessionLoaded = !sessionLoading;
  const [demo, setDemo] = useState(false);
  const [editorRevision, setEditorRevision] = useState(0);
  const [designated, setDesignated] = useState<Song | null>(null);
  const [editorPool, setEditorPool] = useState<Song[]>([]);
  const [manage, setManage] = useState(true);
  const playerSaveLock = useRef(false);
  const [savingPlayer, setSavingPlayer] = useState(false);
  const [opening, setOpening] = useState(false);
  const load = useCallback(async () => {
    try {
      const r = await fetch(apiPath, { cache: "no-store" });
      const d = (await r.json()) as {
        error: string;
        tournament: Tournament;
        demo: boolean;
        user: Viewer | null;
        demoAllowed: boolean;
        match: Match;
        revision: number;
        designated: Song | null;
      };
      if (!r.ok) throw Error(d.error);
      setTournament((previous) =>
        d.tournament.revision >= previous.revision ? d.tournament : previous,
      );
      setDemo(d.demo);
      setLoaded(true);
      setConnectionError("");
    } catch (e) {
      setConnectionError(e instanceof Error ? e.message : "赛况连接中断。");
    }
  }, []);
  async function savePlayer(action: PlayerAction, revision: number) {
    if (playerSaveLock.current) return false;
    playerSaveLock.current = true;
    setSavingPlayer(true);
    try {
      const response = await fetch(apiPath + "/players", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, revision }) });
      const result = await response.json() as { error?: string; tournament: Tournament };
      if (!response.ok) throw new Error(result.error || "保存失败，请稍后重试。");
      setTournament(previous => result.tournament.revision >= previous.revision ? result.tournament : previous);
      if (action.type === "replace") {
        setSelected(result.tournament.matches.find(match => match.id === action.matchId) ?? null);
        setEditorRevision(result.tournament.revision);
      }
      toast.success(action.type === "replace" ? "对阵已更新，受影响比赛的选曲草稿已清空。" : "选手资料已保存");
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "连接失败，请刷新确认保存结果。");
      await load();
      return false;
    } finally { playerSaveLock.current = false; setSavingPlayer(false); }
  }
  useEffect(() => {
    // Hydrate the public snapshot and session after mounting; requests update state asynchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const interval = setInterval(() => void load(), 3000);
    const params = new URLSearchParams(location.search);
    if (params.get("view") === "summary") setView("summary");
    if (params.get("view") === "bracket") setView("bracket");
    if (params.has("authError")) {
      location.replace("/login?authError=" + encodeURIComponent(params.get("authError") || "登录未完成，请重试。"));
    }
    if (params.has("manage")) {
      setView("admin");
      history.replaceState(null, "", location.pathname);
    }
    return () => clearInterval(interval);
  }, [load]);
  async function openMatch(m: Match) {
    void refreshSongs();
    if (canManage && manage) {
      setOpening(true);
      try {
        const r = await fetch(apiPath + "/matches/" + encodeURIComponent(m.id));
        const d = (await r.json()) as {
          pool: Song[];
          error: string;
          tournament: Tournament;
          demo: boolean;
          user: Viewer | null;
          demoAllowed: boolean;
          match: Match;
          revision: number;
          designated: Song | null;
        };
        if (!r.ok) throw Error(d.error);
        setEditorRevision(d.revision);
        setDesignated(d.designated);
        setEditorPool(d.pool);
        setSelected(d.match);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "打开失败。");
      } finally {
        setOpening(false);
      }
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
  const selected =
    selectedDraft && !(canManage && manage)
      ? (tournament.matches.find((m) => m.id === selectedDraft.id) ??
        selectedDraft)
      : selectedDraft;
  useEffect(() => {
    const context = (
      document as unknown as {
        modelContext?: {
          registerTool: (tool: unknown, options: unknown) => Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(
      context.registerTool(
        {
          name: "read_hachicats_tournament",
          title: "读取八猫杯公开赛况",
          description:
            "读取当前公开的三组比赛状态、比分与晋级对阵。",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true },
          async execute(input: unknown) {
            if (
              !input ||
              typeof input !== "object" ||
              Object.keys(input).length
            )
              throw Error("此工具不接受参数。");
            const r = await fetch(apiPath);
            if (!r.ok) throw Error("赛事服务暂时不可用。");
            return r.json();
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {});
    return () => lifecycle.abort();
  }, []);
  const matches = tournament.matches.filter((m) => m.group === group);
  const firstAttacker = selected ? firstAttack(selected) : null;
  const live = tournament.matches
    .filter((m) => m.status === "live")
    .sort((a, b) => a.station.localeCompare(b.station));
  const completed = matches.filter(
    (m) => m.status === "complete" || m.status === "bye",
  ).length;
  function matchCard(m: Match) {
    const score = totals(m);
    return (
      <div className="match-slot" key={m.id}>
      <button
        className={`match ${m.status}`}
        onClick={() => void openMatch(m)}
        aria-label={`${roundNames[m.round]} ${m.a?.name ?? "待定"} 对 ${m.b?.name ?? "待定"}`}
      >
        <span className="match-meta">
          <span>
            {String(m.index + 1).padStart(2, "0")}{" "}
            <span className={`match-id ${m.round === 3 ? "final-label" : ""}`}>
              / {m.round === 4 ? "季军赛" : roundNames[m.round]}
            </span>
          </span>
          <span>
            {m.status === "live" ? (
              <>
                <i />
                进行中
              </>
            ) : m.status === "complete" ? (
              "已结束"
            ) : m.status === "bye" ? (
              "轮空晋级"
            ) : (
              "待开始"
            )}
          </span>
        </span>
        {(["a", "b"] as const).map((side, i) => (
          <span
            key={side}
            className={`player ${m.winner === m[side]?.id ? "winner" : ""}`}
          >
            <span className="seed">{m[side]?.seed ?? "—"}</span>
            <span className="player-profile">
              <span className="player-name">{m[side]?.name ?? "等待晋级"}</span>
              {m[side] && <PlayerRating rating={m[side].rating} />}
            </span>
            <span className="score">
              {m.scores.length ? score[i].toLocaleString() : "—"}
            </span>
          </span>
        ))}
      </button>
      </div>
    );
  }
  return (
    <>
      <Toaster position="top-center" richColors />
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" href="/">
            <span className="brand-icon">
              <Cat size={25} />
            </span>
            HachiCats<span className="edition">八猫杯</span>
          </Link>
          <span className="local-tag">{demo ? "本地 Demo" : "第一届"}</span>
          <Link className="login" href={loginHref("/hachicats/20260927?manage=1")} aria-label={user ? "账号" : "登录"}>
            <ShieldCheck size={16} />
            <span>{user ? user?.name : "登录"}</span>
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </header>
      <main className="container">
        <section className="event-head">
          <div>
            <span className="event-kicker">OURTAIKO COMMUNITY TOURNAMENT</span>
            <h1>
              第一届八猫杯<span className="edition-no">/ 01</span>
            </h1>
            <div className="event-details">
              <span>
                <CalendarDays size={16} />
                2026.09.27 · 周日 12:00
              </span>
              <span>
                <MapPin size={16} />
                猫鼓旗舰店 · 上海
              </span>
            </div>
          </div>
          <div className="event-format">
            <span>
              48<span>位选手</span>
            </span>
            <span>
              3<span>个组别</span>
            </span>
            <span>
              单败<span>淘汰赛制</span>
            </span>
          </div>
        </section>
        <div className="workspace-nav">
          <Tabs value={view} onValueChange={setView}>
            <TabsList className="main-tabs" variant="line">
              <TabsTrigger value="summary">
                <ChartNoAxesColumn />
                赛事总结
              </TabsTrigger>
              <TabsTrigger value="bracket">
                <GitBranch />
                赛事对阵
              </TabsTrigger>
              <TabsTrigger value="songs">
                <Music2 />
                分组曲库
              </TabsTrigger>
              <TabsTrigger value="rules">
                <CalendarDays />
                赛事指南
              </TabsTrigger>
              <TabsTrigger value="admin">
                <ShieldCheck />
                赛事管理
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <span className="sync-label">
            <span className="sync-dot" />
            {connectionError
              ? "连接中断"
              : !loaded
                ? "正在同步"
                : "每 3 秒同步"}
          </span>
        </div>
        {connectionError && (
          <div role="alert" className="connection-error">
            {connectionError}{" "}
            <button onClick={() => void load()}>重新连接</button>
          </div>
        )}
        {canManage && view === "bracket" && (
          <div className="management-bar">
            <span>
              <ShieldCheck size={16} />
              {user?.demo ? "演示管理模式" : user?.name}
            </span>
            <button
              className={manage ? "active" : ""}
              onClick={() => { setSelected(null); setManage(!manage); }}
            >
              {manage ? "正在管理 · 切换为观众" : "观众视图 · 切换为管理"}
            </button>
            <button onClick={() => void signOut()}>退出</button>
          </div>
        )}
        {opening && (
          <div className="loading-match" role="status">
            正在打开比赛…
          </div>
        )}
        {view === "bracket" && (
          <section className="live-section">
            <div className="section-heading">
              <h2>
                <Radio size={19} />
                正在进行<span className="count">{live.length}</span>
              </h2>
              <span>
                {manage ? "点击比赛录分 / 管理" : "点击比赛查看详情"}
              </span>
            </div>
            {live.length ? (
              <div className="live-grid">
                {live.map((m) => (
                  <button
                    className="live-card"
                    onClick={() => void openMatch(m)}
                    key={m.id}
                  >
                    <div className="live-card-head">
                      <span className="live-label">
                        <i />
                        LIVE · {m.station} 台
                      </span>
                      <span>
                        {roundNames[m.round]} · 第 {m.index + 1} 场
                        <ChevronRight size={16} />
                      </span>
                    </div>
                    <div className="live-card-group">
                      {groups.find((g) => g.id === m.group)?.name}
                    </div>
                    <div className="versus">
                      <div>
                        <span className="avatar">
                          {m.a?.name.slice(0, 1).toUpperCase()}
                        </span>
                        <b>{m.a?.name}</b>
                        {m.a && <PlayerRating rating={m.a.rating} />}
                        <span className="live-total">
                          {totals(m)[0].toLocaleString()}
                        </span>
                      </div>
                      <span className="versus-word">VS</span>
                      <div>
                        <span className="avatar">
                          {m.b?.name.slice(0, 1).toUpperCase()}
                        </span>
                        <b>{m.b?.name}</b>
                        {m.b && <PlayerRating rating={m.b.rating} />}
                        <span className="live-total">
                          {totals(m)[1].toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="live-card-foot">
                      <Music2 size={15} />
                      <span>
                        {displaySongName(
                          m.group,
                          m.scores.find((s) => s.a === null || s.b === null)
                            ?.songId ??
                            m.scores.at(-1)?.songId ??
                            "",
                        )}
                      </span>
                      <span>
                        {
                          m.scores.filter((s) => s.a !== null && s.b !== null)
                            .length
                        }{" "}
                        / {m.scores.length} 首已录分
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-live">
                <Radio size={23} />
                <span>暂无进行中的比赛</span>
                <small>开赛后，赛况将在这里同步。</small>
              </div>
            )}
          </section>
        )}
        {view === "summary" && <TournamentChampions tournament={tournament} loaded={loaded} onOpen={m => void openMatch(m)} />}
        {(view === "bracket" || view === "songs" || view === "summary" || (view === "admin" && canManage)) && <div className="group-row">
          <Tabs value={group} onValueChange={(v) => setGroup(v as GroupId)}>
            <TabsList className="group-tabs">
              {groups.map((g) => (
                <TabsTrigger value={g.id} key={g.id}>
                  {g.name}
                  <span>16 人</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <span className="group-caption">
            {groups.find((g) => g.id === group)?.en} ·{" "}
            {groups.find((g) => g.id === group)?.range}
          </span>
        </div>}
        {view === "summary" && <TournamentSummary key={group} tournament={tournament} group={group} catalog={catalog} pool={pools[group]} loaded={loaded} onOpen={m => void openMatch(m)} />}
        {view === "bracket" && (
          <>
            <section className="bracket-section">
              <div className="section-heading">
                <h2>晋级之路</h2>
                <span>已完成 {completed} / 16 场</span>
              </div>
              <Tabs
                value={String(round)}
                onValueChange={(v) => setRound(Number(v))}
                className="mobile-rounds"
              >
                <TabsList>
                  {roundNames.map((r, i) => (
                    <TabsTrigger key={r} value={String(i)}>
                      {r}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <div className="bracket-board">
                {[0, 1, 2, 3].map((r) => (
                  <div
                    key={r}
                    className={`round-column ${round === r ? "visible-round" : ""}`}
                  >
                    <div className="round-title">
                      <span>{roundNames[r]}</span>
                      <small>
                        {[16, 8, 4, 2][r]} → {[8, 4, 2, 1][r]}
                      </small>
                    </div>
                    <div className="round-matches">
                      {r === 3 ? <div className="championship">
                        <div className="round-title">
                          <span>冠军赛</span>
                          <Trophy size={15} />
                        </div>
                        {matches.filter((m) => m.round === r).map(matchCard)}
                      </div> : matches.filter((m) => m.round === r).map(matchCard)}
                    </div>
                    {r === 3 && (
                      <div className="bronze">
                        <div className="round-title">
                          <span>季军赛</span>
                          <Trophy size={15} />
                        </div>
                        {matches.filter((m) => m.round === 4).map(matchCard)}
                      </div>
                    )}
                  </div>
                ))}
                <div
                  className={`mobile-bronze ${round === 4 ? "visible-round" : ""}`}
                >
                  {matches.filter((m) => m.round === 4).map(matchCard)}
                </div>
              </div>
              <div className="bracket-legend">
                <span>
                  <i className="legend-live" />
                  进行中
                </span>
                <span>
                  <i className="legend-done" />
                  已结束
                </span>
                <span>单败淘汰 · 半决赛败者进入季军赛</span>
              </div>
            </section>
            <section className="reserve-section" aria-label="替补区">
              <div className="section-heading"><h2>替补区 <span className="count">{reserves(tournament, group).length}</span></h2>
                {canManage && manage && <button className="secondary-button" onClick={() => setView("admin")}>管理选手资料</button>}
              </div>
              <div className="reserve-list">{reserves(tournament, group).map(p => <div className="reserve-player" key={p.id}><b>{p.name}</b><PlayerRating rating={p.rating} /></div>)}</div>
              {!reserves(tournament, group).length && <p className="muted">本组暂无替补选手。</p>}
            </section>
          </>
        )}
        {view === "songs" && (
          <section className="song-section">
            <div className="section-heading">
              <h2>{groups.find((g) => g.id === group)?.name}曲库</h2>
              <span>{pools[group].length ? `${pools[group].length} 首正赛课题曲` : '曲库加载中'}</span>
            </div>
            <p className="song-sync-note" role="status">
              {songNotice || "曲名与星级来自 OurTaiko，每 30 秒自动更新。"}
            </p>
            <div className="song-list">
              {pools[group].map((id, i) => {
                const s = catalog[id];
                return (
                  <div className="song-row" key={s.id}>
                    <span className="song-index">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <Music2 size={20} />
                    <span className="song-title">
                      {s.title}
                      {s.difficultyIndex !== 4 && (
                        <small>{difficultyNames[s.difficultyIndex]}</small>
                      )}
                    </span>
                    <span className="stars">★ {s.stars ?? "—"}</span>
                  </div>
                );
              })}
            </div>
            <div className="designated">
              <Trophy size={22} />
              <div>
                <h3>决赛与季军赛指定曲</h3>
                <p>由裁判于比赛现场公布。</p>
              </div>
            </div>
          </section>
        )}
        {view === "rules" && (
          <section className="rules">
            <h2>9 月 27 日，鼓前见。</h2>
            <p>第一场 12:00 开始，按暹罗组、狸花组、布偶组依次进行。</p>
            <div className="rule-grid">
              <article>
                <span>01</span>
                <h3>单败，向下一轮前进</h3>
                <p>
                  每组 16
                  名选手，比赛总分更高者晋级。半决赛败者进入季军赛，临时缺席可由主办方设置轮空晋级。
                </p>
              </article>
              <article>
                <span>02</span>
                <h3>选择两首，禁用一首</h3>
                <p>
                  双方各选 2 首，再各禁用对手的 1
                  首。此前选择并游玩过的曲目不可再选；允许重复禁用。重复选曲由裁判从未禁用曲目中抽签补足。
                </p>
              </article>
              <article>
                <span>03</span>
                <h3>每一分，都算数</h3>
                <p>
                  16 进 8 和 8 进 4 中，rating 低于对手 0.50 及以上
                  的选手可先攻，否则猜拳决定。16 进 8
                  至半决赛计算两首总分。季军赛、决赛增加一首指定曲。总分相同则抽取额外曲目加赛。
                </p>
              </article>
              <article>
                <span>04</span>
                <h3>来到现场</h3>
                <p>
                  猫鼓旗舰店
                  <br />
                  上海市七莘路 1599 弄平金中心 B2
                </p>
                <a
                  href="https://map.bemanicn.com/s/6791#shop-info"
                  target="_blank"
                  rel="noreferrer"
                >
                  查看店铺位置 <ArrowUpRight size={14} />
                </a>
              </article>
            </div>
          </section>
        )}
        {view === "admin" && (
          <section className="admin-welcome">
            <ShieldCheck size={34} />
            <h2>赛事管理</h2>
            {!sessionLoaded ? <p role="status">正在验证登录状态…</p> : sessionError ? (
              <>
                <p role="alert">{sessionError}</p>
                <button className="secondary-button" onClick={() => void loadSession()}>重新验证</button>
              </>
            ) : canManage ? (
              <>
                <p>{user?.name}，欢迎回来。选手资料与赛事维护在这里管理，换人、选曲和录分请打开对应比赛详情。</p>
                <div className="admin-actions">
                  <button className="primary-button" onClick={() => { setManage(true); setView("bracket"); }}>前往比赛管理 <ChevronRight size={16} /></button>
                  <button className="secondary-button" onClick={() => void signOut()}>退出登录</button>
                </div>
                {demo && <p className="muted">本地演示模式中的操作只影响演示赛况。</p>}
              </>
            ) : (
              <>
                <p>{user ? "此账号暂无赛事管理权限，请联系主办方授权。" : "赛事管理仅向已获主办方授权的账号开放。"}</p>
                <a className="primary-button" href={loginHref("/hachicats/20260927?manage=1")}>{user ? "查看账号" : "前往登录"} <ArrowUpRight size={16} /></a>
              </>
            )}
            {canManage && <PlayerManager key={group} tournament={tournament} group={group}
              disabled={!loaded || !!connectionError || savingPlayer} onSave={savePlayer} />}
            {canManage && <ResetTournament
              tournamentId={tournamentId}
              revision={tournament.revision}
              demo={demo}
              disabled={!loaded || !!connectionError}
              onReset={(next) => {
                setSelected(null);
                setDesignated(null);
                setEditorRevision(next.revision);
                setTournament((previous) => next.revision >= previous.revision ? next : previous);
                setRound(0);
                setView("bracket");
                toast.success("赛事已重置，重置前的赛况已自动备份。");
                void load();
              }}
            />}
          </section>
        )}
        <footer>
          <span>
            <Cat size={17} />
            HachiCats · 第一届八猫杯
          </span>
          <span>
            {demo
              ? "选手与曲库来自赛事资料 · 当前比分为演示数据"
              : "选手与曲库来自赛事资料 · 赛况自动同步"}
          </span>
        </footer>
      </main>
      <Sheet open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <SheetContent className="match-sheet">
          <SheetHeader>
            <SheetTitle>比赛详情</SheetTitle>
            <SheetDescription>
              {selected &&
                `${groups.find((g) => g.id === selected.group)?.name} · ${roundNames[selected.round]} · 第 ${selected.index + 1} 场`}
            </SheetDescription>
          </SheetHeader>
          {selected && (
            <div className="sheet-body">
              <div className="match-contestants">
                {(["a", "b"] as const).map((side) => (
                  <div key={side}>
                    <h2>{selected[side]?.name ?? "待定"}</h2>
                    {selected[side] && firstAttacker === selected[side].id && (
                      <span className="first-attack" title="Rating 低于对手至少 0.50，可先攻">
                        <Flag size={12} aria-hidden="true" />先攻
                      </span>
                    )}
                    {selected[side] && <PlayerRating rating={selected[side].rating} />}
                  </div>
                ))}
                <span className="contestants-vs">VS</span>
              </div>
              <p className="rating-source">RT 为报名时的 rating v2</p>
              {canManage && manage ? (
                <MatchEditor
                  tournamentId={tournamentId}
                  key={selected.id + "-" + editorRevision}
                  match={selected}
                  revision={editorRevision}
                  tournament={tournament}
                  designated={designated}
                  catalog={catalog}
                  pool={editorPool}
                  disabled={!loaded || !!connectionError || savingPlayer}
                  onReplace={(side, playerId) => savePlayer({ type: "replace", matchId: selected.id, side, playerId }, editorRevision)}
                  onSaved={(m, r) => {
                    const resultConfirmed = m.status === "complete" || m.status === "bye";
                    setSelected(resultConfirmed ? null : m);
                    setEditorRevision(r);
                    void load();
                    void refreshSongs();
                    toast.success(
                      resultConfirmed
                        ? "结果已确认，对阵图已更新"
                        : "已保存",
                    );
                  }}
                />
              ) : (
                <MatchSummary match={selected} catalog={catalog} />
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
