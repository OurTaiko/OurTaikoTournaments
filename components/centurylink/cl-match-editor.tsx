"use client";
import { useState } from "react";
import { Check, ChevronRight, Music2, Radio, Save, Shuffle, Swords } from "lucide-react";
import { tournamentApiPath } from "@/lib/tournaments";
import { difficultyNames, type Song, type SongCatalog } from "@/lib/songs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Picker } from "@/components/match-editor";
import {
  clBanCount, clDecision, clDefinition, clDrawCount, clPickCount, clPlayer, clPoints, clSeed,
  clTotals, isSpecial, type CenturyLink, type ClMatch,
} from "@/lib/centurylink";
import { clDrawable, clPickable, clRegularCount, type ClAction } from "@/lib/centurylink-rules";
import ClMatchSummary from "./cl-match-summary";
import { clSongName, clSongNumber } from "./cl-songs";

const kindHelp = {
  pickban: "高顺位选手先禁用 1 首，低顺位后禁用 1 首；再由高顺位先选 1 首、低顺位后选 1 首。比较两首总分。",
  draw: "不 Ban 不选，由主办方从本阶段曲库重新抽取 2 首（双方本阶段已游玩的曲目除外）。比较两首总分。",
  designated: "双方各禁用 1 首、各选 1 首，再演奏 1 首指定曲。比较三首总分；第三首由前两首总分低者先演奏。",
  points: "双方轮流各禁用 1 首（总决赛中胜者组冠军多禁用 1 首），主办方随机抽取 4 首。每首得分高者得 1 分，先得 3 分获胜；2:2 时演奏决胜曲。",
} as const;

function randomItem<T>(items: T[]) {
  return items[crypto.getRandomValues(new Uint32Array(1))[0] % items.length];
}

export default function ClMatchEditor({ tournamentId, tournament, match, revision, pool, designated, catalog: publicCatalog, disabled, onSaved }: {
  tournamentId: string;
  tournament: CenturyLink;
  match: ClMatch;
  revision: number;
  pool: Song[];
  designated: Song | null;
  catalog: SongCatalog;
  disabled: boolean;
  onSaved: (match: ClMatch, revision: number) => void;
}) {
  const definition = clDefinition(match.id);
  const [bans, setBans] = useState<ClMatch["bans"]>(match.bans);
  const [picks, setPicks] = useState<ClMatch["picks"]>(match.picks);
  const [scores, setScores] = useState(match.scores);
  const [station, setStation] = useState(match.station);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<ClAction | null>(null);
  const [forfeit, setForfeit] = useState("");
  const catalog = { ...publicCatalog, ...Object.fromEntries(pool.map(song => [song.id, song])), ...(designated ? { [designated.id]: designated } : {}) };
  const name = (id: string) => clSongName(id, catalog);
  const players = [clPlayer(tournament, match.a), clPlayer(tournament, match.b)];
  const live = match.status === "live";
  const draft = { ...match, bans, picks, scores };
  const banCounts = [clBanCount(match.id, 0), clBanCount(match.id, 1)];
  const pickCount = clPickCount(match.id);
  const selectionReady = [0, 1].every(side => bans[side].length === banCounts[side] && picks[side].length === pickCount);
  const points = definition.kind === "points";
  const [ta, tb] = points ? clPoints(draft) : clTotals(draft);
  const decision = clDecision(draft);
  const regular = clRegularCount(match);
  const songLabel = (song: Song) => `曲 ${clSongNumber(song.id)} · ${song.title}${song.difficultyIndex !== 4 ? `（${difficultyNames[song.difficultyIndex]}）` : ""} · ★${song.stars ?? "—"}`;

  function changeBan(side: 0 | 1, index: number, value: string) {
    const next = structuredClone(bans);
    next[side][index] = value;
    next[side] = next[side].filter(Boolean);
    setBans(next);
    // Picks that became banned are no longer valid.
    setPicks(picks.map(list => list.filter(id => !next.flat().includes(id))) as ClMatch["picks"]);
    setScores([]);
  }
  function changePick(side: 0 | 1, value: string) {
    const next = structuredClone(picks);
    next[side] = value ? [value] : [];
    setPicks(next);
    setScores([]);
  }
  function generate() {
    if (!selectionReady) { setError(pickCount ? "请先完成双方 Ban 曲与选曲。" : "请先完成双方 Ban 曲。"); return; }
    if (definition.kind === "pickban") setScores(picks.flat().map(songId => ({ songId, a: null, b: null })));
    else if (definition.kind === "designated") {
      if (!designated) { setError("指定曲信息不可用，请重新打开比赛。"); return; }
      setScores([...picks.flat(), designated.id].map(songId => ({ songId, a: null, b: null })));
    } else {
      const available = clDrawable(tournament, match, bans, []);
      const count = clDrawCount(match.id);
      if (available.length < count) { setError("可抽取的曲目不足，请联系裁判确认。"); return; }
      const drawn: string[] = [];
      while (drawn.length < count) drawn.push(available.splice(available.indexOf(randomItem(available)), 1)[0]);
      setScores(drawn.map(songId => ({ songId, a: null, b: null })));
    }
    setError("");
  }
  function extra() {
    const available = clDrawable(tournament, match, bans, scores);
    if (!available.length) { setError("本阶段可抽取的曲目已用完，请联系裁判确认后续规则。"); return; }
    setScores([...scores, { songId: randomItem(available), a: null, b: null }]);
    setError("");
  }
  function addTiebreak() {
    if (!designated) { setError("决胜曲信息不可用，请重新打开比赛。"); return; }
    setScores([...scores, { songId: designated.id, a: null, b: null }]);
  }
  async function submit(action: ClAction) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(tournamentApiPath(tournamentId) + "/matches/" + encodeURIComponent(match.id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revision, matchRevision: match.revision ?? 0,
          ...(action.type === "bye" ? {} : { bans, picks, scores, station }),
          ...action,
        }),
      });
      const body = await response.json() as { error?: string; match: ClMatch; revision: number };
      if (!response.ok) throw new Error(body.error || "保存失败，请重试。");
      onSaved(body.match, body.revision);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败，请重试。");
    } finally {
      setSaving(false);
      setConfirm(null);
    }
  }
  if (["complete", "bye"].includes(match.status)) return <ClMatchSummary tournament={tournament} match={match} catalog={catalog} />;
  if (!players[0] || !players[1]) return <div className="empty-live">等待前置比赛结束后确定对阵。</div>;
  const winnerName = confirm?.type === "bye"
    ? players.find(p => p?.id === forfeit)?.name
    : decision === null ? "" : players[decision]?.name;
  const tiebreakAdded = scores.some(s => isSpecial(s.songId));
  const pointsTied = points && scores.length >= regular && scores.every(s => s.a !== null && s.b !== null) && ta === tb && ta < 3;
  const sumTied = !points && scores.length > 0 && scores.every(s => s.a !== null && s.b !== null) && ta === tb;

  return (
    <fieldset className="editor" disabled={saving || disabled}>
      <div className="private-note">
        <Music2 size={15} />
        <span>{kindHelp[definition.kind]}</span>
      </div>
      {definition.kind !== "draw" && <>
        <div className="form-heading">
          <h3>01 <span>{pickCount ? "Ban 曲与选曲" : "Ban 曲"}</span></h3>
          <span>{pickCount ? "各 Ban 1 首 · 各选 1 首" : match.id === "G14" ? "胜者组冠军 Ban 2 首" : "各 Ban 1 首"}</span>
        </div>
        <div className="pick-sides">
          {([0, 1] as const).map(side => {
            const player = players[side]!;
            const otherBans = bans[1 - side];
            return (
              <div className="pick-side" key={side}>
                <h4>{player.name}</h4>
                <span className="player-rating">排位 #{clSeed(tournament, player.id) ?? "—"}</span>
                {Array.from({ length: banCounts[side] }, (_, i) => (
                  <Picker key={`ban-${i}`} label={`${player.name} Ban 曲${banCounts[side] > 1 ? ` ${i + 1}` : ""}`}
                    value={bans[side][i] ?? ""} disabled={live} onChange={v => changeBan(side, i, v)}
                    options={pool.map(song => ({ value: song.id, label: songLabel(song),
                      disabled: otherBans.includes(song.id) || bans[side].some((id, j) => j !== i && id === song.id) }))} />
                ))}
                {pickCount > 0 && <Picker label={`${player.name} 选曲`} value={picks[side][0] ?? ""} disabled={live}
                  onChange={v => changePick(side, v)}
                  options={clPickable(tournament, match, bans).map(id => pool.find(song => song.id === id)!).filter(Boolean)
                    .map(song => ({ value: song.id, label: songLabel(song), disabled: picks[1 - side].includes(song.id) }))} />}
              </div>
            );
          })}
        </div>
      </>}
      <div className="editor-inline">
        <Picker label="比赛机台" value={station} onChange={setStation} disabled={live}
          options={[{ value: "A", label: "A 台" }, { value: "B", label: "B 台" }]} />
        <button className="secondary-button" disabled={saving || live || !selectionReady} onClick={generate}>
          <Shuffle size={16} />
          {definition.kind === "draw" || points ? `抽取 ${clDrawCount(match.id)} 首曲目` : "生成比赛曲目"}
        </button>
      </div>
      <div className="form-heading">
        <h3>{definition.kind === "draw" ? "01" : "02"} <span>成绩录入</span></h3>
        <span>{points ? "逐曲得分制 · 先得 3 分" : definition.kind === "designated" ? "三首总分制" : "两首总分制"}</span>
      </div>
      {scores.length === 0 ? (
        <p className="form-help">{definition.kind === "draw" || points ? "点击抽取后生成比赛曲目；" : "Ban 曲与选曲完成后生成曲目；"}每首成绩由裁判手动填写。</p>
      ) : (
        <>
          <div className="score-column-head"><span>课题曲</span><span>{players[0].name}</span><span>{players[1].name}</span></div>
          {scores.map((s, i) => (
            <div className="score-input-row" key={s.songId}>
              <div>
                <small>{String(i + 1).padStart(2, "0")} · {isSpecial(s.songId) ? (points ? "决胜曲" : "指定曲") : i >= regular ? "加赛曲" : points || definition.kind === "draw" ? "抽取曲" : "选曲"}</small>
                <span>{name(s.songId)}</span>
              </div>
              {(["a", "b"] as const).map((side, sideIndex) => (
                <input key={side} aria-label={`${name(s.songId)} ${players[sideIndex]!.name}成绩`}
                  inputMode="numeric" type="number" min="0" max="2000000" step="1" value={s[side] ?? ""} placeholder="待录入"
                  onChange={e => {
                    const next = structuredClone(scores);
                    next[i][side] = e.target.value === "" ? null : Number(e.target.value);
                    setScores(next);
                  }} />
              ))}
            </div>
          ))}
          <div className="total-row">
            <b>{points ? "得分" : "总分"}</b>
            <strong>{ta.toLocaleString()}</strong>
            <strong>{tb.toLocaleString()}</strong>
          </div>
          <div className="cl-editor-extra">
            {points && !tiebreakAdded && <button className="text-button" onClick={addTiebreak} disabled={saving || !pointsTied}>
              <Swords size={14} />2:2 平 · 加入决胜曲
            </button>}
            {(!points || tiebreakAdded) && <button className="text-button" onClick={extra} disabled={saving}>
              <Shuffle size={14} />同分加赛 · 抽取一首
            </button>}
          </div>
        </>
      )}
      <div className="editor-actions">
        {match.status === "pending" ? (
          <>
            <button className="secondary-button" disabled={saving} onClick={() => void submit({ type: "draft" })}><Save size={16} />保存草稿</button>
            <button className="primary-button" disabled={saving || scores.length < regular} onClick={() => void submit({ type: "start" })}><Radio size={16} />开始比赛</button>
          </>
        ) : (
          <>
            <button className="secondary-button" disabled={saving} onClick={() => void submit({ type: "save" })}><Save size={16} />保存比分</button>
            <button className="primary-button" disabled={saving || decision === null} onClick={() => setConfirm({ type: "finish" })}><Check size={16} />确认赛果</button>
          </>
        )}
      </div>
      {(pointsTied || sumTied) && <p className="form-help">{pointsTied && !tiebreakAdded ? "四曲后比分持平，请加入决胜曲。" : "比分持平，请抽取加赛曲目后再确认赛果。"}</p>}
      <div className="bye-area">
        <h3>弃权 / 判负</h3>
        <p>选手缺席、退赛或被判负时，指定获胜的一方，无需填写成绩。</p>
        <Picker label="获胜的选手" value={forfeit} onChange={setForfeit}
          options={players.map(p => ({ value: p!.id, label: p!.name }))} />
        <button className="text-button" disabled={!forfeit || saving} onClick={() => setConfirm({ type: "bye", winner: forfeit })}>
          判定获胜<ChevronRight size={15} />
        </button>
      </div>
      {error && <p role="alert" className="form-error">{error}</p>}
      <AlertDialog open={!!confirm} onOpenChange={v => !v && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.type === "bye" ? "确认判定胜负？" : "确认本场赛果？"}</AlertDialogTitle>
            <AlertDialogDescription>
              {winnerName} 将获胜{definition.eliminates ? `，另一方获得${definition.eliminates}` : "，另一方进入败者组"}。确认后立即更新公开对阵图，页面不提供撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>返回检查</AlertDialogCancel>
            <AlertDialogAction className="primary-button" disabled={saving} onClick={e => { e.preventDefault(); if (confirm) void submit(confirm); }}>
              {saving ? "正在保存…" : "确认并更新对阵"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </fieldset>
  );
}
