import { Trophy } from "lucide-react";
import { songName, type SongCatalog } from "@/lib/songs";
import { totals, type Match } from "@/lib/tournament";

export default function MatchSummary({ match, catalog }: { match: Match; catalog: SongCatalog }) {
  const done = match.status === "complete" || match.status === "bye";
  const winner = [match.a, match.b].find(player => player?.id === match.winner);
  const names = [match.a?.name ?? "上位选手", match.b?.name ?? "下位选手"];
  const sum = totals(match);
  return (
    <div className="match-summary">
      {done && <div className="result-box">
        <Trophy size={26} />
        <h3>{winner?.name ?? "结果已确认"}{winner ? (match.round === 3 ? " 获得冠军" : match.round === 4 ? " 获得季军" : " 晋级") : ""}</h3>
        <p>{match.status === "bye" ? "轮空直接晋级" : "结果已确认，以下为本场比赛记录。"}</p>
      </div>}
      {match.published && <>
        <section className="match-selection-summary" aria-label="双方选曲与 Ban">
          <h3>选曲与 Ban</h3>
          {([0, 1] as const).map(side => <div className="selection-record" key={side}>
            <h4>{names[side]}</h4>
            <ul>{match.picks[side].map(id => <li key={id}>
              <span>{songName(match.group, id, catalog)}</span>
              {match.bans[1 - side] === id && <small>被对方 Ban</small>}
            </li>)}</ul>
            {!match.picks[side].length && <p>暂无选曲记录</p>}
            <p>Ban 对方：{match.bans[side] ? songName(match.group, match.bans[side], catalog) : "暂无"}</p>
          </div>)}
        </section>
        {match.scores.length > 0 && <section className="match-score-summary" aria-label="逐曲比分">
          <h3>逐曲比分</h3>
          <table>
            <thead><tr><th scope="col">曲目</th>{names.map((name, i) => <th scope="col" key={i}>{name}</th>)}</tr></thead>
            <tbody>{match.scores.map((score, i) => <tr key={`${score.songId}-${i}`}>
              <th scope="row"><small>第 {i + 1} 首{score.songId.startsWith("special:") ? " · 指定曲" : ""}</small>{songName(match.group, score.songId, catalog)}</th>
              <td>{score.a?.toLocaleString() ?? "待录入"}</td>
              <td>{score.b?.toLocaleString() ?? "待录入"}</td>
            </tr>)}</tbody>
            <tfoot><tr><th scope="row">当前总分</th><td>{sum[0].toLocaleString()}</td><td>{sum[1].toLocaleString()}</td></tr></tfoot>
          </table>
        </section>}
      </>}
      {!match.published && match.status !== "bye" && <div className="empty-live">比赛尚未公布，选曲确认后将在这里显示。</div>}
    </div>
  );
}
