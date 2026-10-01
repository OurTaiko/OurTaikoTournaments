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
import * as s from "@/components/styles";
import { cn } from "@/lib/utils";
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
  function matchCard(m: Match, connector = true) {
    const score = totals(m);
    return (
      <div className={s.matchSlot} key={m.id}>
      <button
        className={cn(s.matchCard, m.status === "live" && s.matchLive, connector && s.matchConnector)}
        onClick={() => setSelected(m)}
        aria-label={`${roundNames[m.round]} ${m.a?.name ?? "待定"} 对 ${m.b?.name ?? "待定"}`}
      >
        <span className={s.matchMeta}>
          <span>
            {String(m.index + 1).padStart(2, "0")}{" "}
            <span className={cn("hidden mobile:inline", m.round === 3 && "inline text-[#626975]")}>
              / {m.round === 4 ? "季军赛" : roundNames[m.round]}
            </span>
          </span>
          <span className={cn(s.matchStatus, m.status === "live" && "text-primary")}>
            {m.status === "live" ? (
              <>
                <i className={s.dot} />
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
        {(["a", "b"] as const).map((side, i) => {
          const won = m.winner === m[side]?.id;
          return (
          <span
            key={side}
            className={s.player}
          >
            <span className={s.seed}>{m[side]?.seed ?? "—"}</span>
            <span className={s.playerProfile}>
              <span className={cn(s.playerName, won && s.winnerText, !won && m.status === "complete" && "text-[#797981]", won && m.status === "bye" && "after:content-['_↗'] after:text-[12px]")}>{m[side]?.name ?? "等待晋级"}</span>
              {m[side] && <PlayerRating rating={m[side].rating} />}
            </span>
            <span className={cn(s.score, won && s.winnerText)}>
              {m.scores.length ? score[i].toLocaleString() : "—"}
            </span>
          </span>
          );
        })}
      </button>
      </div>
    );
  }
  return (
    <>
      <header className={s.topbar}>
        <div className={s.topbarInner}>
          <Link className={s.brand} href="/">
            <span className={s.brandIcon}>
              <Cat size={25} />
            </span>
            HachiCats<span className={s.edition}>八猫杯</span>
          </Link>
          <span className={s.localTag}>第一届</span>
        </div>
      </header>
      <main className={s.container}>
        <section className={s.eventHead}>
          <div>
            <span className={s.eventKicker}>OURTAIKO COMMUNITY TOURNAMENT</span>
            <h1 className={s.eventTitle}>
              第一届八猫杯<span className={s.editionNo}>/ 01</span>
            </h1>
            <div className={s.eventDetails}>
              <span className={s.eventDetail}>
                <CalendarDays size={16} />
                2026.09.27 · 周日 12:00
              </span>
              <span className={s.eventDetail}>
                <MapPin size={16} />
                猫鼓旗舰店 · 上海
              </span>
            </div>
            <Link className={s.galleryButton} href="/hachicats/20260927/gallery">
              <Images size={16} />
              赛事相册
              <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className={s.eventFormat}>
            <span className={s.eventFormatItem}>
              48<span className={s.eventFormatLabel}>位选手</span>
            </span>
            <span className={s.eventFormatItem}>
              3<span className={s.eventFormatLabel}>个组别</span>
            </span>
            <span className={s.eventFormatItem}>
              单败<span className={s.eventFormatLabel}>淘汰赛制</span>
            </span>
          </div>
        </section>
        <div className={s.workspaceNav}>
          <Tabs value={view} onValueChange={setView} className={s.workspaceTabs}>
            <TabsList className={s.mainTabs} variant="line">
              <TabsTrigger className={s.mainTab} value="summary">
                <ChartNoAxesColumn />
                赛事总结
              </TabsTrigger>
              <TabsTrigger className={s.mainTab} value="bracket">
                <GitBranch />
                赛事对阵
              </TabsTrigger>
              <TabsTrigger className={s.mainTab} value="songs">
                <Music2 />
                分组曲库
              </TabsTrigger>
              <TabsTrigger className={s.mainTab} value="rules">
                <CalendarDays />
                赛事指南
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <span className={s.syncLabel}>赛事已结束 · 最终赛果</span>
        </div>
        {view === "summary" && <TournamentChampions tournament={tournament} loaded={loaded} onOpen={setSelected} />}
        {view !== "rules" && <div className="flex items-center justify-between mt-7 mb-[30px] mobile:my-[23px]">
          <Tabs value={group} onValueChange={(v) => setGroup(v as GroupId)} className="mobile:w-full">
            <TabsList className="bg-[#e9e9ed]! p-1! h-11! rounded-[12px]! gap-[3px] mobile:w-full">
              {groups.map((g) => (
                <TabsTrigger value={g.id} key={g.id} className="min-w-[112px] py-2 px-4 text-[14px] leading-[calc(1.25/0.875)] rounded-[9px]! data-[state=active]:bg-white! data-[state=active]:shadow-[0_2px_5px_#00000007]! mobile:min-w-0! mobile:py-2! mobile:px-[11px]!">
                  {g.name}
                  <span className="text-[11px] text-[#818189] ml-1.5">16 人</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <span className="text-[12px] text-[#85858c] tracking-[1px] mobile:hidden">
            {groups.find((g) => g.id === group)?.en} ·{" "}
            {groups.find((g) => g.id === group)?.range}
          </span>
        </div>}
        {view === "summary" && <TournamentSummary key={group} tournament={tournament} group={group} catalog={catalog} pool={pools[group]} loaded={loaded} onOpen={setSelected} />}
        {view === "bracket" && (
          <>
            <section className={s.bracketSection}>
              <div className={s.sectionHeading}>
                <h2 className={s.sectionTitle}>晋级之路</h2>
                <span className={s.sectionNote}>已完成 {completed} / 16 场</span>
              </div>
              <Tabs
                value={String(round)}
                onValueChange={(v) => setRound(Number(v))}
                className={s.mobileRounds}
              >
                <TabsList className={s.mobileRoundsList}>
                  {roundNames.map((r, i) => (
                    <TabsTrigger key={r} value={String(i)} className={s.mobileRoundsTab}>
                      {r}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <div className="grid grid-cols-4 gap-[23px] mobile:block">
                {[0, 1, 2, 3].map((r) => (
                  <div
                    key={r}
                    className={round === r ? "" : "mobile:hidden"}
                  >
                    <div className={cn(s.roundTitle, "mobile:hidden")}>
                      <span>{roundNames[r]}</span>
                      <small className={s.roundTitleNote}>
                        {[16, 8, 4, 2][r]} → {[8, 4, 2, 1][r]}
                      </small>
                    </div>
                    <div className={cn("flex flex-col justify-around gap-3 h-[1040px] mobile:h-auto! mobile:grid mobile:grid-cols-[1fr] mobile:gap-3!", (r === 1 || r === 2) && "gap-0", r === 3 && "h-[520px]")}>
                      {r === 3 ? <div>
                        <div className={cn(s.roundTitle, "mobile:hidden")}>
                          <span>冠军赛</span>
                          <Trophy size={15} />
                        </div>
                        {matches.filter((m) => m.round === r).map(m => matchCard(m))}
                      </div> : matches.filter((m) => m.round === r).map(m => matchCard(m))}
                    </div>
                    {r === 3 && (
                      <div className="pt-[26px] mobile:hidden">
                        <div className={cn(s.roundTitle, "mobile:hidden")}>
                          <span>季军赛</span>
                          <Trophy size={15} />
                        </div>
                        {matches.filter((m) => m.round === 4).map(m => matchCard(m))}
                      </div>
                    )}
                  </div>
                ))}
                <div
                  className={cn("hidden!", round === 4 && "mobile:block!")}
                >
                  {matches.filter((m) => m.round === 4).map(m => matchCard(m, false))}
                </div>
              </div>
              <div className={s.bracketLegend}>
                <span className={s.legendItem}>
                  <i className={cn(s.dot, "bg-[#a4a4af]")} />
                  已结束
                </span>
                <span className={s.legendNote}>单败淘汰 · 半决赛败者进入季军赛</span>
              </div>
            </section>
            <section className="mt-6 p-5 border border-[#e4e4e9] rounded-[12px]" aria-label="替补区">
              <div className={s.sectionHeading}><h2 className={s.sectionTitle}>替补区 <span className={s.count}>{reserves(tournament, group).length}</span></h2>
              </div>
              <div className="flex flex-wrap gap-3">{reserves(tournament, group).map(p => <div className="flex items-center gap-2.5 py-2.5 px-3.5 bg-[#f4f4f7] rounded-[8px]" key={p.id}><b>{p.name}</b><PlayerRating rating={p.rating} /></div>)}</div>
              {!reserves(tournament, group).length && <p className={s.muted}>本组暂无替补选手。</p>}
            </section>
          </>
        )}
        {view === "songs" && (
          <section>
            <div className={s.sectionHeading}>
              <h2 className={s.sectionTitle}>{groups.find((g) => g.id === group)?.name}曲库</h2>
              <span className={s.sectionNote}>{pools[group].length} 首正赛课题曲</span>
            </div>
            <div className={s.songList}>
              {pools[group].map((id, i) => {
                const song = catalog[id];
                return (
                  <div className={s.songRow} key={song.id}>
                    <span className={s.songIndex}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <Music2 size={20} className={s.songIcon} />
                    <span className={s.songTitle}>
                      {song.title}
                      {song.difficultyIndex !== 4 && (
                        <small className={s.songTag}>{difficultyNames[song.difficultyIndex]}</small>
                      )}
                    </span>
                    <span className={s.stars}>★ {song.stars ?? "—"}</span>
                  </div>
                );
              })}
            </div>
            <div className={s.designated}>
              <Trophy size={22} />
              <div>
                <h3 className={s.designatedTitle}>决赛与季军赛指定曲</h3>
                {(["final", "third"] as const).map((slot) => {
                  const song = catalog[`special:${group}:${slot}`];
                  return song && (
                    <p key={slot} className={s.designatedText}>
                      {slot === "final" ? "冠军赛" : "季军赛"}：{song.title}
                      {song.difficultyIndex !== 4 && `（${difficultyNames[song.difficultyIndex]}）`} · ★ {song.stars ?? "—"}
                    </p>
                  );
                })}
              </div>
            </div>
          </section>
        )}
        {view === "rules" && (
          <section className={s.rules}>
            <h2 className={s.rulesTitle}>赛事规则回顾</h2>
            <p className={s.rulesLede}>2026 年 9 月 27 日 12:00 开赛，按暹罗组、狸花组、布偶组依次进行。</p>
            <div className={s.ruleGrid}>
              <article className={s.ruleCard}>
                <span className={s.ruleNo}>01</span>
                <h3 className={s.ruleTitle}>单败，向下一轮前进</h3>
                <p className={s.ruleText}>
                  每组 16
                  名选手，比赛总分更高者晋级。半决赛败者进入季军赛，临时缺席可由主办方设置轮空晋级。
                </p>
              </article>
              <article className={s.ruleCard}>
                <span className={s.ruleNo}>02</span>
                <h3 className={s.ruleTitle}>选择两首，禁用一首</h3>
                <p className={s.ruleText}>
                  双方各选 2 首，再各禁用对手的 1
                  首。此前选择并游玩过的曲目不可再选；允许重复禁用。重复选曲由裁判从未禁用曲目中抽签补足。
                </p>
              </article>
              <article className={s.ruleCard}>
                <span className={s.ruleNo}>03</span>
                <h3 className={s.ruleTitle}>每一分，都算数</h3>
                <p className={s.ruleText}>
                  16 进 8 和 8 进 4 中，rating 低于对手 0.50 及以上
                  的选手可先攻，否则猜拳决定。16 进 8
                  至半决赛计算两首总分。季军赛、决赛增加一首指定曲。总分相同则抽取额外曲目加赛。
                </p>
              </article>
              <article className={s.ruleCard}>
                <span className={s.ruleNo}>04</span>
                <h3 className={s.ruleTitle}>来到现场</h3>
                <p className={s.ruleText}>
                  猫鼓旗舰店
                  <br />
                  上海市七莘路 1599 弄平金中心 B2
                </p>
                <a
                  className={s.ruleLink}
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
        <footer className={s.footer}>
          <span className={s.footerBrand}>
            <Cat size={17} />
            HachiCats · 第一届八猫杯
          </span>
          <span>赛果存档 · 曲名与星级来自 OurTaiko</span>
        </footer>
      </main>
      <Sheet open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <SheetContent className={s.matchSheet}>
          <SheetHeader className={s.sheetHeader}>
            <SheetTitle className={s.sheetTitle}>比赛详情</SheetTitle>
            <SheetDescription className={s.sheetDescription}>
              {selected &&
                `${groups.find((g) => g.id === selected.group)?.name} · ${roundNames[selected.round]} · 第 ${selected.index + 1} 场`}
            </SheetDescription>
          </SheetHeader>
          {selected && (
            <div className={s.sheetBody}>
              <div className={s.contestants}>
                {(["a", "b"] as const).map((side) => (
                  <div key={side} className={side === "b" ? "col-start-3" : undefined}>
                    <h2 className={s.contestantName}>{selected[side]?.name ?? "待定"}</h2>
                    {selected[side] && firstAttacker === selected[side].id && (
                      <span className="inline-flex items-center gap-1 mb-[5px] py-[3px] px-[7px] rounded-[5px] bg-[#e8f2ff] text-[#0066c7] text-[11px] font-semibold leading-[1.3]" title="Rating 低于对手至少 0.50，可先攻">
                        <Flag size={12} aria-hidden="true" />先攻
                      </span>
                    )}
                    {selected[side] && <PlayerRating rating={selected[side].rating} />}
                  </div>
                ))}
                <span className={s.contestantsVs}>VS</span>
              </div>
              <p className={s.ratingSource}>RT 为报名时的 rating v2</p>
              <MatchSummary match={selected} catalog={catalog} />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
