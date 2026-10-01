"use client";
import { useState } from "react";
import { ChevronDown, ChevronRight, Crown, Medal, Music2, TrendingUp, Swords } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { groupChampions, summarizeGroup, type MatchStanding } from "@/lib/tournament-summary";
import { groups, roundNames, totals, type GroupId, type Match, type Tournament } from "@/lib/tournament";
import { songName, type SongCatalog } from "@/lib/songs";
import PlayerRating from "./player-rating";
import { count, sectionHeading, sectionNote, sectionTitle } from "./styles";
import { cn } from "@/lib/utils";

const recapNote = "text-[#74747d] text-[12px] leading-[1.8] mt-2 mb-4";
const recapEmpty = "p-5 text-[#77777f] text-[13px] bg-white border border-dashed border-[#dce0e8] rounded-[12px] leading-[1.8]";
const recapRank = "text-[#7a8190] text-[13px] w-6 shrink-0 text-center tabular-nums mobile:w-[18px]";
const recapSection = "mt-8 min-w-0";
const recapHeading = cn(sectionHeading, "mb-2");
const recapTitle = cn(sectionTitle, "mobile:text-[16px]");

const championCard = "flex flex-col items-center text-center min-w-0 py-6 px-4 border border-[#e5e5e9] rounded-[18px] bg-white mobile:py-4 mobile:px-2 mobile:rounded-[13px]";
const championCaption = "flex items-center justify-center gap-[3px] text-[11px] text-primary mt-4 mobile:text-[9px] mobile:mt-3";
const recapPick = "text-[17px] font-semibold mobile:text-[14px]";

export function TournamentChampions({ tournament, loaded, onOpen }: { tournament: Tournament; loaded: boolean; onOpen: (match: Match) => void }) {
  return <section className="mt-7" aria-label="各组冠军">
    <div className={sectionHeading}><h2 className={sectionTitle}><Crown size={19} />各组冠军</h2></div>
    <div className="grid grid-cols-3 gap-[18px] mobile:gap-2">
      {groupChampions(tournament).map(({ group, winner, match }) => {
        const groupName = groups.find(g => g.id === group)!.name;
        const awaiting = !(loaded && match);
        const content = <><span className="text-[12px] text-[#6e6e73] tracking-[0.08em] mobile:text-[11px]">{groupName}</span><Crown className={cn("text-primary mt-[18px] mb-3 mobile:w-6 mobile:mt-3 mobile:mb-2.5", awaiting && "text-[#96969e]")} size={28} />
          <span className={cn("text-[22px] font-[650] wrap-anywhere mb-[7px] mobile:text-[15px]", awaiting && "text-[#96969e]")}>{loaded ? winner?.name ?? "冠军待决出" : "正在同步…"}</span>
          {loaded && winner ? <><PlayerRating rating={winner.rating} /><span className={cn(championCaption, awaiting && "text-[#96969e]")}>冠军 · 查看赛果<ChevronRight size={12} /></span></> : <span className={cn(championCaption, awaiting && "text-[#96969e]")}>{loaded ? "等待冠军赛结果" : "正在加载赛事记录"}</span>}
        </>;
        return loaded && match ? <button key={group} className={cn(championCard, "hover:border-primary hover:shadow-[0_4px_20px_#866d1b0b]")} aria-label={`${groupName}冠军 ${winner!.name}，查看赛果`} onClick={() => onOpen(match)}>{content}</button>
          : <div key={group} className={cn(championCard, "bg-[#fafafa] border-[#e4e4e9]")}>{content}</div>;
      })}
    </div>
  </section>;
}

function ResultCard({ result, upset = false, onOpen }: { result: MatchStanding; upset?: boolean; onOpen: (match: Match) => void }) {
  const { match, margin, ratingGap } = result;
  const scores = totals(match);
  return <button className="block w-full border border-[#e4e4e9] rounded-[16px] bg-white text-left p-[18px] mt-3.5 hover:border-[#9fc1ec]" onClick={() => onOpen(match)}>
    <span className="flex items-center justify-between text-[#77777f] text-[12px]"><span>{roundNames[match.round]} · 第 {match.index + 1} 场</span><ChevronRight size={16} /></span>
    <span className="grid grid-cols-2 gap-[18px] my-[18px]">
      {([match.a!, match.b!] as const).map((player, index) => <span key={player.id} className="min-w-0">
        <b className="block text-[15px] wrap-anywhere mb-1.5">{player.name}{match.winner === player.id && <small className="text-primary bg-accent text-[10px] rounded-[4px] py-0.5 px-[5px] ml-1.5">胜</small>}</b>
        <PlayerRating rating={player.rating} />
        <strong className="block text-[18px] font-[550] mt-2 tabular-nums">{scores[index].toLocaleString()}</strong>
      </span>)}
    </span>
    <span className="block border-t border-[#eef0f5] pt-3 text-[12px] text-primary">{upset ? `Rating 相差 ${(ratingGap / 100).toFixed(2)}，低 rating 方获胜` : `总分仅差 ${margin.toLocaleString()} 分`}</span>
  </button>;
}

export default function TournamentSummary({ tournament, group, catalog, pool, loaded, onOpen }: {
  tournament: Tournament; group: GroupId; catalog: SongCatalog; pool: string[]; loaded: boolean; onOpen: (match: Match) => void;
}) {
  const summary = summarizeGroup(tournament, group, catalog, pool);
  const [ranking, setRanking] = useState("selections");
  const rankedSongs = ranking === "bans" ? summary.bannedSongs : summary.songs;
  if (!loaded) return <p className={recapEmpty} role="status">正在加载赛事记录…</p>;
  return <section aria-label="赛事总结">
    <header className="flex justify-between items-center gap-4 mb-3">
      <div><span className="text-[#77777f] text-[10px] tracking-[0.18em]">TOURNAMENT RECAP</span><h2 className="text-[25px] font-[650] mt-1.5 mobile:text-[21px]">{groups.find(g => g.id === group)?.name} · 赛事总结</h2></div>
      <span className="whitespace-nowrap text-[#6e6e73] text-[12px]"><b className="text-[25px] text-primary mr-[3px]">{summary.completed}</b> 场已结算</span>
    </header>
    <p className={recapNote}>仅统计已公布、已确认赛果且比分完整的比赛，不含轮空。赛事进行中也可查看，数据随赛况更新。</p>

    <section className={recapSection} aria-label="曲目选用与 Ban 排名">
      <div className={recapHeading}><h2 className={recapTitle}><Music2 size={19} />曲目选用与 Ban 排名</h2><span className={sectionNote}>{summary.songs.length} 首曲目</span></div>
      <p className={recapNote}>按双方原始选曲计次，包含被 Ban 的选择；双方同选一曲计 2 次。指定曲、随机补曲和加赛不增加选曲次数。点击曲目展开选手最高分榜。</p>
      {!summary.completed && <p className={recapEmpty}>本组暂无已结算比赛，排名将在赛果确认后生成。</p>}
      <Tabs value={ranking} onValueChange={setRanking} className="mb-4"><TabsList aria-label="曲目排名方式">
        <TabsTrigger value="selections">选用次数排名</TabsTrigger><TabsTrigger value="bans">Ban 次数排名</TabsTrigger>
      </TabsList></Tabs>
      <div className="border border-[#e4e4e9] rounded-[16px] overflow-hidden bg-white">
        {rankedSongs.map(song => <details className="group not-first:border-t not-first:border-[#eeeef2]" key={song.id}>
          <summary className="flex items-center gap-4 list-none py-[18px] px-[22px] cursor-pointer [&::-webkit-details-marker]:hidden hover:bg-[#f7f9fc] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-[-3px] mobile:py-4 mobile:px-3 mobile:gap-[9px]">
            <span className={recapRank}>{ranking === "bans" ? song.banRank : song.rank}</span>
            <span className="flex-1 min-w-0 text-[15px] font-[550] wrap-anywhere mobile:text-[13px]">{songName(group, song.id, catalog)}<small className="block mt-[5px] text-[11px] text-[#77777f] font-normal">{song.leaders.length} 位选手 · 游玩 {song.plays} 场</small></span>
            <span className="flex gap-6 text-[12px] text-[#77777f] whitespace-nowrap mobile:flex-col mobile:gap-[3px] mobile:text-[10px]"><span className={ranking === "selections" ? "text-primary" : ""}><b className={recapPick}>{song.selections}</b> 次选用</span><span className={ranking === "bans" ? "text-primary" : ""}>Ban <b className={recapPick}>{song.bans}</b> 次</span></span>
            <ChevronDown size={17} className="text-[#8a8a93] shrink-0 [transition:transform_.15s] group-open:[transform:rotate(180deg)]" />
          </summary>
          <div className="border-t border-[#eef0f5] py-5 px-6 bg-[#f8faff] mobile:py-4 mobile:px-3">
            <h3 className="flex items-center gap-2 text-[14px] font-semibold"><Medal size={16} />选手最高分排行</h3>
            <p className={recapNote}>同一选手仅保留最高分；同分并列。点击比分查看比赛。</p>
            {song.leaders.length ? <ol>{song.leaders.map(entry => <li key={entry.player.id} className="flex items-center gap-3 py-2.5 border-t border-[#e9edf4]">
              <span className={recapRank}>{entry.rank}</span><span className="flex-1 min-w-0 wrap-anywhere text-[13px]">{entry.player.name}</span>
              <button className="flex items-center gap-1.5 text-primary text-[14px] tabular-nums py-1.5" onClick={() => onOpen(entry.match)} aria-label={`查看 ${entry.player.name} 的 ${entry.score.toLocaleString()} 分比赛`}>{entry.score.toLocaleString()}<ChevronRight size={14} /></button>
            </li>)}</ol> : <p className={recapEmpty}>暂无已结算的游玩成绩。</p>}
          </div>
        </details>)}
      </div>
    </section>

    <div className="grid grid-cols-2 gap-6 mobile:grid-cols-1 mobile:gap-0">
      <section className={recapSection} aria-label="最大 rating 逆转">
        <div className={recapHeading}><h2 className={recapTitle}><TrendingUp size={19} />最大 Rating 逆转</h2></div>
        <p className={recapNote}>低 rating 选手获胜的比赛中，找出双方 rating 差距最大的一场；并列则全部展示。RT 使用报名时的 rating v2。</p>
        {summary.upsets.length ? summary.upsets.map(result => <ResultCard key={result.match.id} result={result} upset onOpen={onOpen} />) : <p className={recapEmpty}>暂无低 rating 选手获胜的已结算比赛。</p>}
      </section>
      <section className={recapSection} aria-label="分差小于 2000 的比赛">
        <div className={recapHeading}><h2 className={recapTitle}><Swords size={19} />毫厘之争<span className={count}>{summary.closeMatches.length}</span></h2></div>
        <p className={recapNote}>双方所有曲目总分（含指定曲和加赛）相差小于 2,000 分，按分差从小到大排列。</p>
        {summary.closeMatches.length ? summary.closeMatches.map(result => <ResultCard key={result.match.id} result={result} onOpen={onOpen} />) : <p className={recapEmpty}>暂无总分差小于 2,000 分的已结算比赛。</p>}
      </section>
    </div>
  </section>;
}
