"use client";
import { useState } from "react";
import { ChevronDown, ChevronRight, Crown, Medal, Music2, TrendingUp, Swords } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { groupChampions, summarizeGroup, type MatchStanding } from "@/lib/tournament-summary";
import { groups, roundNames, totals, type GroupId, type Match, type Tournament } from "@/lib/tournament";
import { songName, type SongCatalog } from "@/lib/songs";
import PlayerRating from "./player-rating";

export function TournamentChampions({ tournament, loaded, onOpen }: { tournament: Tournament; loaded: boolean; onOpen: (match: Match) => void }) {
  return <section className="recap-champions" aria-label="各组冠军">
    <div className="section-heading"><h2><Crown size={19} />各组冠军</h2></div>
    <div className="champions-row">
      {groupChampions(tournament).map(({ group, winner, match }) => {
        const groupName = groups.find(g => g.id === group)!.name;
        const content = <><span className="champion-group">{groupName}</span><Crown className="champion-crown" size={28} />
          <span className="champion-name">{loaded ? winner?.name ?? "冠军待决出" : "正在同步…"}</span>
          {loaded && winner ? <><PlayerRating rating={winner.rating} /><span className="champion-caption">冠军 · 查看赛果<ChevronRight size={12} /></span></> : <span className="champion-caption">{loaded ? "等待冠军赛结果" : "正在加载赛事记录"}</span>}
        </>;
        return loaded && match ? <button key={group} className="champion-card" aria-label={`${groupName}冠军 ${winner!.name}，查看赛果`} onClick={() => onOpen(match)}>{content}</button>
          : <div key={group} className="champion-card awaiting">{content}</div>;
      })}
    </div>
  </section>;
}

function ResultCard({ result, upset = false, onOpen }: { result: MatchStanding; upset?: boolean; onOpen: (match: Match) => void }) {
  const { match, margin, ratingGap } = result;
  const scores = totals(match);
  return <button className="recap-match" onClick={() => onOpen(match)}>
    <span className="recap-match-meta"><span>{roundNames[match.round]} · 第 {match.index + 1} 场</span><ChevronRight size={16} /></span>
    <span className="recap-contestants">
      {([match.a!, match.b!] as const).map((player, index) => <span key={player.id}>
        <b>{player.name}{match.winner === player.id && <small>胜</small>}</b>
        <PlayerRating rating={player.rating} />
        <strong>{scores[index].toLocaleString()}</strong>
      </span>)}
    </span>
    <span className="recap-match-footer">{upset ? `Rating 相差 ${(ratingGap / 100).toFixed(2)}，低 rating 方获胜` : `总分仅差 ${margin.toLocaleString()} 分`}</span>
  </button>;
}

export default function TournamentSummary({ tournament, group, catalog, pool, loaded, onOpen }: {
  tournament: Tournament; group: GroupId; catalog: SongCatalog; pool: string[]; loaded: boolean; onOpen: (match: Match) => void;
}) {
  const summary = summarizeGroup(tournament, group, catalog, pool);
  const [ranking, setRanking] = useState("selections");
  const rankedSongs = ranking === "bans" ? summary.bannedSongs : summary.songs;
  if (!loaded) return <p className="recap-empty" role="status">正在加载赛事记录…</p>;
  return <section className="tournament-summary" aria-label="赛事总结">
    <header className="recap-heading">
      <div><span className="recap-eyebrow">TOURNAMENT RECAP</span><h2>{groups.find(g => g.id === group)?.name} · 赛事总结</h2></div>
      <span className="recap-count"><b>{summary.completed}</b> 场已结算</span>
    </header>
    <p className="recap-note">仅统计已公布、已确认赛果且比分完整的比赛，不含轮空。赛事进行中也可查看，数据随赛况更新。</p>

    <section className="recap-section" aria-label="曲目选用与 Ban 排名">
      <div className="section-heading"><h2><Music2 size={19} />曲目选用与 Ban 排名</h2><span>{summary.songs.length} 首曲目</span></div>
      <p className="recap-note">按双方原始选曲计次，包含被 Ban 的选择；双方同选一曲计 2 次。指定曲、随机补曲和加赛不增加选曲次数。点击曲目展开选手最高分榜。</p>
      {!summary.completed && <p className="recap-empty">本组暂无已结算比赛，排名将在赛果确认后生成。</p>}
      <Tabs value={ranking} onValueChange={setRanking} className="recap-sort"><TabsList aria-label="曲目排名方式">
        <TabsTrigger value="selections">选用次数排名</TabsTrigger><TabsTrigger value="bans">Ban 次数排名</TabsTrigger>
      </TabsList></Tabs>
      <div className="recap-songs">
        {rankedSongs.map(song => <details className="recap-song" key={song.id}>
          <summary>
            <span className="recap-rank">{ranking === "bans" ? song.banRank : song.rank}</span>
            <span className="recap-song-name">{songName(group, song.id, catalog)}<small>{song.leaders.length} 位选手 · 游玩 {song.plays} 场</small></span>
            <span className="recap-picks"><span className={ranking === "selections" ? "active" : ""}><b>{song.selections}</b> 次选用</span><span className={ranking === "bans" ? "active" : ""}>Ban <b>{song.bans}</b> 次</span></span>
            <ChevronDown size={17} className="recap-chevron" />
          </summary>
          <div className="recap-leaders">
            <h3><Medal size={16} />选手最高分排行</h3>
            <p className="recap-note">同一选手仅保留最高分；同分并列。点击比分查看比赛。</p>
            {song.leaders.length ? <ol>{song.leaders.map(entry => <li key={entry.player.id}>
              <span className="recap-rank">{entry.rank}</span><span className="recap-player-name">{entry.player.name}</span>
              <button onClick={() => onOpen(entry.match)} aria-label={`查看 ${entry.player.name} 的 ${entry.score.toLocaleString()} 分比赛`}>{entry.score.toLocaleString()}<ChevronRight size={14} /></button>
            </li>)}</ol> : <p className="recap-empty">暂无已结算的游玩成绩。</p>}
          </div>
        </details>)}
      </div>
    </section>

    <div className="recap-highlights">
      <section className="recap-section" aria-label="最大 rating 逆转">
        <div className="section-heading"><h2><TrendingUp size={19} />最大 Rating 逆转</h2></div>
        <p className="recap-note">低 rating 选手获胜的比赛中，找出双方 rating 差距最大的一场；并列则全部展示。RT 使用报名时的 rating v2。</p>
        {summary.upsets.length ? summary.upsets.map(result => <ResultCard key={result.match.id} result={result} upset onOpen={onOpen} />) : <p className="recap-empty">暂无低 rating 选手获胜的已结算比赛。</p>}
      </section>
      <section className="recap-section" aria-label="分差小于 2000 的比赛">
        <div className="section-heading"><h2><Swords size={19} />毫厘之争<span className="count">{summary.closeMatches.length}</span></h2></div>
        <p className="recap-note">双方所有曲目总分（含指定曲和加赛）相差小于 2,000 分，按分差从小到大排列。</p>
        {summary.closeMatches.length ? summary.closeMatches.map(result => <ResultCard key={result.match.id} result={result} onOpen={onOpen} />) : <p className="recap-empty">暂无总分差小于 2,000 分的已结算比赛。</p>}
      </section>
    </div>
  </section>;
}
