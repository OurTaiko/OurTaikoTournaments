import { Trophy } from "lucide-react";
import { songName, type SongCatalog } from "@/lib/songs";
import { totals, type Match } from "@/lib/tournament";
import * as st from "@/components/styles";
import { cn } from "@/lib/utils";

export default function MatchSummary({ match, catalog }: { match: Match; catalog: SongCatalog }) {
  const done = match.status === "complete" || match.status === "bye";
  const winner = [match.a, match.b].find(player => player?.id === match.winner);
  const names = [match.a?.name ?? "上位选手", match.b?.name ?? "下位选手"];
  const sum = totals(match);
  return (
    <div>
      {done && <div className={st.resultBox}>
        <Trophy size={26} />
        <h3 className={cn(st.summaryHeading, st.resultTitle)}>{winner?.name ?? "结果已确认"}{winner ? (match.round === 3 ? " 获得冠军" : match.round === 4 ? " 获得季军" : " 晋级") : ""}</h3>
        <p className={st.resultText}>{match.status === "bye" ? "轮空直接晋级" : "结果已确认，以下为本场比赛记录。"}</p>
      </div>}
      {match.published && <>
        <section className={st.summarySection} aria-label="双方选曲与 Ban">
          <h3 className={st.summaryHeading}>选曲与 Ban</h3>
          {([0, 1] as const).map(side => <div className={st.selectionRecord} key={side}>
            <h4 className={st.selectionName}>{names[side]}</h4>
            <ul>{match.picks[side].map(id => <li key={id} className={st.selectionItem}>
              <span>{songName(match.group, id, catalog)}</span>
              {match.bans[1 - side] === id && <small className={st.selectionBanned}>被对方 Ban</small>}
            </li>)}</ul>
            {!match.picks[side].length && <p className={st.selectionNote}>暂无选曲记录</p>}
            <p className={st.selectionNote}>Ban 对方：{match.bans[side] ? songName(match.group, match.bans[side], catalog) : "暂无"}</p>
          </div>)}
        </section>
        {match.scores.length > 0 && <section className={st.summarySection} aria-label="逐曲比分">
          <h3 className={st.summaryHeading}>逐曲比分</h3>
          <table className={st.scoreTable}>
            <thead><tr><th scope="col" className={st.scoreSongCell}>曲目</th>{names.map((name, i) => <th scope="col" key={i} className={st.scoreCell}>{name}</th>)}</tr></thead>
            <tbody>{match.scores.map((score, i) => <tr key={`${score.songId}-${i}`}>
              <th scope="row" className={st.scoreSongCell}><small className={st.scoreCellNote}>第 {i + 1} 首{score.songId.startsWith("special:") ? " · 指定曲" : ""}</small>{songName(match.group, score.songId, catalog)}</th>
              <td className={st.scoreCell}>{score.a?.toLocaleString() ?? "待录入"}</td>
              <td className={st.scoreCell}>{score.b?.toLocaleString() ?? "待录入"}</td>
            </tr>)}</tbody>
            <tfoot className={st.scoreTotals}><tr><th scope="row" className={st.scoreSongCell}>当前总分</th><td className={st.scoreCell}>{sum[0].toLocaleString()}</td><td className={st.scoreCell}>{sum[1].toLocaleString()}</td></tr></tfoot>
          </table>
        </section>}
      </>}
      {!match.published && match.status !== "bye" && <div className={st.emptyLive}>比赛尚未公布，选曲确认后将在这里显示。</div>}
    </div>
  );
}
