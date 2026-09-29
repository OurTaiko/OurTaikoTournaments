"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp, Check, Pencil, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { CL_PLAYER_COUNT, type CenturyLink } from "@/lib/centurylink";
import { clCanReopenRanking, type ClPlayerAction } from "@/lib/centurylink-rules";

type Props = {
  tournament: CenturyLink;
  disabled: boolean;
  onSave: (action: ClPlayerAction, revision: number) => Promise<boolean>;
};

export function ClPlayerManager({ tournament, disabled, onSave }: Props) {
  const [draft, setDraft] = useState<{ id: string | null; name: string; revision: number } | null>(null);
  const locked = tournament.ranking.status === "complete";
  const stale = !!draft && draft.revision !== tournament.revision;
  return <section className="player-manager" aria-label="选手管理">
    <div className="section-heading"><h2>正赛选手 <span className="count">{tournament.players.length} / {CL_PLAYER_COUNT}</span></h2>
      <button className="secondary-button" disabled={disabled || !!draft || locked || tournament.players.length >= CL_PLAYER_COUNT}
        onClick={() => setDraft({ id: null, name: "", revision: tournament.revision })}><Plus size={15} />添加选手</button>
    </div>
    <p className="muted">{locked
      ? "排位已确认，名单已锁定。如需替换选手（例如工作人员陪跑递补），可直接修改昵称。"
      : "海选与 Last Chance 结束后录入 8 位晋级选手的昵称。排位确认前可随时增删、调整。"}</p>
    {draft && <form className="player-edit-form" onSubmit={async e => {
      e.preventDefault();
      const action: ClPlayerAction = draft.id ? { type: "edit", id: draft.id, name: draft.name } : { type: "add", name: draft.name };
      if (await onSave(action, draft.revision)) setDraft(null);
    }}>
      <h3>{draft.id ? "修改昵称" : "添加正赛选手"}</h3>
      <label>选手昵称<input required autoFocus maxLength={40} value={draft.name} disabled={disabled} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
      {stale && <p role="status">赛事已更新。请取消后重新打开，避免覆盖其他工作人员的修改。</p>}
      <div className="player-form-actions">
        <button className="primary-button" disabled={disabled || stale} type="submit"><Save size={15} />保存</button>
        <button className="secondary-button" disabled={disabled} type="button" onClick={() => setDraft(null)}>取消</button>
      </div>
    </form>}
    <div className="roster-list">
      {tournament.players.map((p, i) => <div className="roster-row cl-roster-row" key={p.id}>
        <span className="player-profile"><b>{p.name}</b></span>
        {!locked && <span className="cl-row-tools">
          <button className="icon-button" aria-label={`上移 ${p.name}`} disabled={disabled || !!draft || i === 0} onClick={() => void onSave({ type: "move", id: p.id, offset: -1 }, tournament.revision)}><ArrowUp size={15} /></button>
          <button className="icon-button" aria-label={`下移 ${p.name}`} disabled={disabled || !!draft || i === tournament.players.length - 1} onClick={() => void onSave({ type: "move", id: p.id, offset: 1 }, tournament.revision)}><ArrowDown size={15} /></button>
          <button className="icon-button" aria-label={`移除 ${p.name}`} disabled={disabled || !!draft} onClick={() => { if (confirm(`移除选手「${p.name}」？`)) void onSave({ type: "remove", id: p.id }, tournament.revision); }}><Trash2 size={15} /></button>
        </span>}
        <button className="secondary-button" disabled={disabled || !!draft} aria-label={`修改 ${p.name} 的昵称`}
          onClick={() => setDraft({ id: p.id, name: p.name, revision: tournament.revision })}><Pencil size={14} />昵称</button>
      </div>)}
      {!tournament.players.length && <p className="muted">尚未录入选手。</p>}
    </div>
  </section>;
}

/** Sort by score; players with equal scores keep the order chosen by staff after a tiebreak. */
function rankingOrder(t: CenturyLink, previous: string[]) {
  const rank = (id: string) => { const i = previous.indexOf(id); return i < 0 ? Infinity : i; };
  return [...t.players].sort((a, b) => (b.rankingScore ?? -1) - (a.rankingScore ?? -1) || rank(a.id) - rank(b.id)).map(p => p.id);
}

export function ClRankingManager({ tournament, disabled, onSave }: Props) {
  const confirmed = tournament.ranking.status === "complete";
  const [scores, setScores] = useState<Record<string, string>>(() =>
    Object.fromEntries(tournament.players.map(p => [p.id, p.rankingScore?.toString() ?? ""])));
  const [revision, setRevision] = useState(tournament.revision);
  const [tieOrder, setTieOrder] = useState<string[]>([]);
  // Refresh inputs when others edit the roster or scores; keep local edits otherwise.
  if (revision !== tournament.revision) {
    setRevision(tournament.revision);
    setScores(Object.fromEntries(tournament.players.map(p => [p.id, p.rankingScore?.toString() ?? ""])));
  }
  const order = confirmed ? tournament.ranking.seeds : rankingOrder(tournament, tieOrder);
  const name = (id: string) => tournament.players.find(p => p.id === id)?.name ?? "—";
  const score = (id: string) => tournament.players.find(p => p.id === id)?.rankingScore ?? null;
  const allScored = tournament.players.length === CL_PLAYER_COUNT && tournament.players.every(p => p.rankingScore !== null);
  const dirty = tournament.players.some(p => (scores[p.id] ?? "") !== (p.rankingScore?.toString() ?? ""));
  const valid = Object.values(scores).every(v => v === "" || (/^\d+$/.test(v) && Number(v) <= 2000000));
  function swap(i: number) {
    const next = [...order];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    setTieOrder(next);
  }
  return <section className="player-manager cl-ranking-manager" aria-label="排位赛录分">
    <div className="section-heading"><h2>排位赛</h2>
      <span>{confirmed ? "排位已确认" : tournament.ranking.status === "live" ? "录分中 · 分数实时公开" : "尚未开始"}</span>
    </div>
    <p className="muted">每位选手单独游玩一首指定曲，按分数从高到低确定 1–8 号顺位（首轮 1v8、2v7、3v6、4v5）。保存分数即向观众公开；同分时请按加赛结果调整顺序后再确认。</p>
    {!confirmed && <>
      <div className="cl-ranking-inputs">
        {tournament.players.map(p => <label key={p.id}>{p.name}
          <input inputMode="numeric" type="number" min="0" max="2000000" step="1" placeholder="待录入" value={scores[p.id] ?? ""} disabled={disabled}
            onChange={e => setScores({ ...scores, [p.id]: e.target.value })} />
        </label>)}
      </div>
      <div className="player-form-actions">
        <button className="secondary-button" disabled={disabled || !dirty || !valid || !tournament.players.length} onClick={() => void onSave({
          type: "ranking-scores",
          scores: tournament.players.map(p => ({ id: p.id, score: scores[p.id] === "" || scores[p.id] === undefined ? null : Number(scores[p.id]) })),
        }, tournament.revision)}><Save size={15} />保存排位分数</button>
      </div>
    </>}
    {tournament.players.length > 0 && <ol className="cl-seed-preview">
      {order.map((id, i) => {
        const tieWithNext = !confirmed && i < order.length - 1 && score(id) !== null && score(id) === score(order[i + 1]);
        return <li key={id}>
          <span className="cl-seed-no">#{i + 1}</span><b>{name(id)}</b>
          <span className="cl-seed-score">{score(id)?.toLocaleString() ?? "—"}</span>
          {tieWithNext && <button className="text-button" disabled={disabled} onClick={() => swap(i)}>同分 · 与下一位交换</button>}
        </li>;
      })}
    </ol>}
    <div className="player-form-actions">
      {confirmed
        ? <button className="secondary-button" disabled={disabled || !clCanReopenRanking(tournament)} onClick={() => {
          if (confirm("撤回排位后首轮对阵将清空，确认撤回？")) void onSave({ type: "ranking-reopen" }, tournament.revision);
        }}><RotateCcw size={15} />撤回排位</button>
        : <button className="primary-button" disabled={disabled || dirty || !allScored} onClick={() => {
          if (confirm("按当前顺序确认排位并生成首轮对阵？")) void onSave({ type: "ranking-confirm", order }, tournament.revision);
        }}><Check size={15} />确认排位并生成首轮对阵</button>}
    </div>
    {!confirmed && !allScored && <p className="form-help">需要 {CL_PLAYER_COUNT} 位选手且全部录入分数后才能确认排位。</p>}
    {confirmed && !clCanReopenRanking(tournament) && <p className="form-help">首轮比赛已有选曲或已开始，排位已锁定。</p>}
  </section>;
}
