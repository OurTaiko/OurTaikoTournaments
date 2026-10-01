import { Trophy } from "lucide-react";
import type { SongCatalog } from "@/lib/songs";
import {
  clDefinition, clPlayer, clPoints, clTotals, isSpecial,
  type CenturyLink, type ClMatch,
} from "@/lib/centurylink";
import { clSongName } from "./cl-songs";
import * as st from "@/components/styles";
import { cn } from "@/lib/utils";

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
    <div>
      {done && <div className={st.resultBox}>
        <Trophy size={26} />
        <h3 className={cn(st.summaryHeading, st.resultTitle)}>{winner?.name ?? "结果已确认"}{winner ? outcome : ""}</h3>
        <p className={st.resultText}>{match.status === "bye" ? "对手弃权或被判负，直接获胜。" : "结果已确认，以下为本场比赛记录。"}</p>
      </div>}
      {match.published && match.status !== "bye" && <>
        {(match.bans.flat().length > 0 || match.picks.flat().length > 0) && <section className={st.summarySection} aria-label="双方 Ban 曲与选曲">
          <h3 className={st.summaryHeading}>Ban 曲与选曲</h3>
          {([0, 1] as const).map(side => <div className={st.selectionRecord} key={side}>
            <h4 className={st.selectionName}>{names[side]}</h4>
            <p className={st.selectionNote}>禁用：{match.bans[side].length ? match.bans[side].map(id => clSongName(id, catalog)).join("、") : "无"}</p>
            {definition.kind !== "points" &&
              <p className={st.selectionNote}>选曲：{match.picks[side].length ? match.picks[side].map(id => clSongName(id, catalog)).join("、") : "暂无"}</p>}
          </div>)}
        </section>}
        {match.scores.length > 0 && <section className={st.summarySection} aria-label="逐曲比分">
          <h3 className={st.summaryHeading}>逐曲比分</h3>
          <table className={st.scoreTable}>
            <thead><tr><th scope="col" className={st.scoreSongCell}>曲目</th>{names.map((name, i) => <th scope="col" key={i} className={st.scoreCell}>{name}</th>)}</tr></thead>
            <tbody>{match.scores.map((score, i) => <tr key={`${score.songId}-${i}`}>
              <th scope="row" className={st.scoreSongCell}><small className={st.scoreCellNote}>第 {i + 1} 首{isSpecial(score.songId) ? (points ? " · 决胜曲" : " · 指定曲") : ""}</small>{clSongName(score.songId, catalog)}</th>
              <td className={cn(st.scoreCell, points && score.a !== null && score.b !== null && score.a > score.b && "text-primary font-semibold")}>{score.a?.toLocaleString() ?? (done ? "未进行" : "待录入")}</td>
              <td className={cn(st.scoreCell, points && score.a !== null && score.b !== null && score.b > score.a && "text-primary font-semibold")}>{score.b?.toLocaleString() ?? (done ? "未进行" : "待录入")}</td>
            </tr>)}</tbody>
            <tfoot className={st.scoreTotals}><tr><th scope="row" className={st.scoreSongCell}>{points ? "得分" : "当前总分"}</th><td className={st.scoreCell}>{ta.toLocaleString()}</td><td className={st.scoreCell}>{tb.toLocaleString()}</td></tr></tfoot>
          </table>
        </section>}
      </>}
      {!match.published && match.status !== "bye" && <div className={st.emptyLive}>比赛尚未开始，Ban 曲与选曲确认后将在这里显示。</div>}
    </div>
  );
}
