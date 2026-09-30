import { Trophy } from "lucide-react";
import type { SongCatalog } from "@/lib/songs";
import {
  clDefinition, clPlayer, clPoints, clTotals, isSpecial,
  type CenturyLink, type ClMatch,
} from "@/lib/centurylink";
import { clSongName } from "./cl-songs";

export default function ClMatchSummary({ tournament, match, catalog }: {
  tournament: CenturyLink; match: ClMatch; catalog: SongCatalog;
}) {
  const definition = clDefinition(match.id);
  const done = match.status === "complete" || match.status === "bye";
  const winner = clPlayer(tournament, match.winner);
  const names = [clPlayer(tournament, match.a)?.name ?? "上方选手", clPlayer(tournament, match.b)?.name ?? "下方选手"];
  const points = definition.kind === "points";
  const [ta, tb] = points ? clPoints(match) : clTotals(match);
  const outcome = match.id === "G14" ? " 获得冠军" : ["G12", "G13"].includes(match.id) ? " 晋级总决赛" : " 获胜";
  return (
    <div className="match-summary">
      {done && <div className="result-box">
        <Trophy size={26} />
        <h3>{winner?.name ?? "结果已确认"}{winner ? outcome : ""}</h3>
        <p>{match.status === "bye" ? "对手弃权或被判负，直接获胜。" : "结果已确认，以下为本场比赛记录。"}</p>
      </div>}
      {match.published && match.status !== "bye" && <>
        {(match.bans.flat().length > 0 || match.picks.flat().length > 0) && <section className="match-selection-summary" aria-label="双方 Ban 曲与选曲">
          <h3>Ban 曲与选曲</h3>
          {([0, 1] as const).map(side => <div className="selection-record" key={side}>
            <h4>{names[side]}</h4>
            <p>禁用：{match.bans[side].length ? match.bans[side].map(id => clSongName(id, catalog)).join("、") : "无"}</p>
            {definition.kind !== "points" &&
              <p>选曲：{match.picks[side].length ? match.picks[side].map(id => clSongName(id, catalog)).join("、") : "暂无"}</p>}
          </div>)}
        </section>}
        {match.scores.length > 0 && <section className="match-score-summary" aria-label="逐曲比分">
          <h3>逐曲比分</h3>
          <table>
            <thead><tr><th scope="col">曲目</th>{names.map((name, i) => <th scope="col" key={i}>{name}</th>)}</tr></thead>
            <tbody>{match.scores.map((score, i) => <tr key={`${score.songId}-${i}`}>
              <th scope="row"><small>第 {i + 1} 首{isSpecial(score.songId) ? (points ? " · 决胜曲" : " · 指定曲") : ""}</small>{clSongName(score.songId, catalog)}</th>
              <td className={points && score.a !== null && score.b !== null && score.a > score.b ? "cl-song-win" : ""}>{score.a?.toLocaleString() ?? (done ? "未进行" : "待录入")}</td>
              <td className={points && score.a !== null && score.b !== null && score.b > score.a ? "cl-song-win" : ""}>{score.b?.toLocaleString() ?? (done ? "未进行" : "待录入")}</td>
            </tr>)}</tbody>
            <tfoot><tr><th scope="row">{points ? "得分" : "当前总分"}</th><td>{ta.toLocaleString()}</td><td>{tb.toLocaleString()}</td></tr></tfoot>
          </table>
        </section>}
      </>}
      {!match.published && match.status !== "bye" && <div className="empty-live">比赛尚未开始，Ban 曲与选曲确认后将在这里显示。</div>}
    </div>
  );
}
