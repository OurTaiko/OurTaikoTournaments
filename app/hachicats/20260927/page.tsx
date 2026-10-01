"use client";
// HachiCats 2026 has finished; the page renders a frozen public snapshot.
// Regenerate with scripts/archive-tournament.mjs, never by hand.
import Link from "next/link";
import { useState, useEffect } from "react";
import {
  Cat,
  CalendarDays,
  MapPin,
  Trophy,
  ArrowUpRight,
  Music2,
  GitBranch,
  Flag,
  ChartNoAxesColumn,
  Images,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetHeader,
} from "@/components/ui/sheet";
import MatchSummary from "@/components/match-summary";
import TournamentSummary, { TournamentChampions } from "@/components/tournament-summary";
import { reserves } from "@/lib/player-management";
import PlayerRating from "@/components/player-rating";
import { difficultyNames, type SongCatalog, type SongPools } from "@/lib/songs";
import {
  groups,
  roundNames,
  firstAttack,
  totals,
  type GroupId,
  type Match,
  type Tournament,
} from "@/lib/tournament";
import archive from "@/data/archive/hachicats-20260927.json";

const tournament = archive.tournament as Tournament;
const catalog = archive.catalog as SongCatalog;
const pools = archive.pools as SongPools;
const loaded = true;
export default function Home() {
  const [group, setGroup] = useState<GroupId>("siamese");
  const [view, setView] = useState("summary");
  const [round, setRound] = useState(0);
  const [selected, setSelected] = useState<Match | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (params.get("view") === "bracket") setView("bracket");
  }, []);
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
          title: "读取八猫杯赛果",
          description: "读取第一届八猫杯三组的最终比赛状态、比分与晋级对阵。",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true },
          async execute(input: unknown) {
            if (!input || typeof input !== "object" || Object.keys(input).length)
              throw Error("此工具不接受参数。");
            return { tournament };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {});
    return () => lifecycle.abort();
  }, []);
  const matches = tournament.matches.filter((m) => m.group === group);
  const firstAttacker = selected ? firstAttack(selected) : null;
  const completed = matches.filter(
    (m) => m.status === "complete" || m.status === "bye",
  ).length;
  function matchCard(m: Match) {
    const score = totals(m);
    return (
      <div className="match-slot" key={m.id}>
      <button
        className={`match ${m.status}`}
        onClick={() => setSelected(m)}
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
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" href="/">
            <span className="brand-icon">
              <Cat size={25} />
            </span>
            HachiCats<span className="edition">八猫杯</span>
          </Link>
          <span className="local-tag">第一届</span>
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
            <Link className="gallery-button" href="/hachicats/20260927/gallery">
              <Images size={16} />
              赛事相册
              <ArrowUpRight size={15} />
            </Link>
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
            </TabsList>
          </Tabs>
          <span className="sync-label">赛事已结束 · 最终赛果</span>
        </div>
        {view === "summary" && <TournamentChampions tournament={tournament} loaded={loaded} onOpen={setSelected} />}
        {view !== "rules" && <div className="group-row">
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
        {view === "summary" && <TournamentSummary key={group} tournament={tournament} group={group} catalog={catalog} pool={pools[group]} loaded={loaded} onOpen={setSelected} />}
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
                  <i className="legend-done" />
                  已结束
                </span>
                <span>单败淘汰 · 半决赛败者进入季军赛</span>
              </div>
            </section>
            <section className="reserve-section" aria-label="替补区">
              <div className="section-heading"><h2>替补区 <span className="count">{reserves(tournament, group).length}</span></h2>
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
              <span>{pools[group].length} 首正赛课题曲</span>
            </div>
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
                {(["final", "third"] as const).map((slot) => {
                  const s = catalog[`special:${group}:${slot}`];
                  return s && (
                    <p key={slot}>
                      {slot === "final" ? "冠军赛" : "季军赛"}：{s.title}
                      {s.difficultyIndex !== 4 && `（${difficultyNames[s.difficultyIndex]}）`} · ★ {s.stars ?? "—"}
                    </p>
                  );
                })}
              </div>
            </div>
          </section>
        )}
        {view === "rules" && (
          <section className="rules">
            <h2>赛事规则回顾</h2>
            <p>2026 年 9 月 27 日 12:00 开赛，按暹罗组、狸花组、布偶组依次进行。</p>
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
        <footer>
          <span>
            <Cat size={17} />
            HachiCats · 第一届八猫杯
          </span>
          <span>赛果存档 · 曲名与星级来自 OurTaiko</span>
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
              <MatchSummary match={selected} catalog={catalog} />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
