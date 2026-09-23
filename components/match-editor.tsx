"use client";
import { useState } from "react";
import {
  Check,
  ChevronRight,
  Shuffle,
  Music2,
  Radio,
  Trophy,
  Save,
} from "lucide-react";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  songs,
  totals,
  songName,
  type Match,
  type Tournament,
} from "@/lib/tournament";
import { usedSongs, type Action } from "@/lib/rules";
export function Picker({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; disabled?: boolean }[];
  disabled?: boolean;
}) {
  return (
    <label className="picker-label">
      <span>{label}</span>
      {/* Native pickers avoid floating-menu resize feedback on small screens. */}
      <NativeSelect
        className="song-picker"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        <NativeSelectOption value="" disabled>
          {label.includes("选手")
            ? "请选择选手"
            : label === "比赛机台"
              ? "请选择机台"
              : "请选择曲目"}
        </NativeSelectOption>
        {options.map((option) => (
          <NativeSelectOption
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </label>
  );
}
export default function MatchEditor({
  match,
  revision,
  tournament,
  designated,
  onSaved,
}: {
  match: Match;
  revision: number;
  tournament: Tournament;
  designated: string | null;
  onSaved: (m: Match, r: number) => void;
}) {
  const [picks, setPicks] = useState<Match["picks"]>(match.picks);
  const [bans, setBans] = useState<Match["bans"]>(match.bans);
  const [scores, setScores] = useState(match.scores);
  const [station, setStation] = useState(match.station);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<Action | null>(null);
  const [bye, setBye] = useState("");
  const done = ["complete", "bye"].includes(match.status);
  const ready =
    picks.every((p) => p.length === 2 && p.every(Boolean)) &&
    bans.every(Boolean);
  const sum = totals({ ...match, scores });
  const pool = songs[match.group];
  function changePick(side: number, index: number, value: string) {
    const next = structuredClone(picks);
    next[side][index] = value;
    setPicks(next);
    setScores([]);
    const nextBans = [...bans] as [string, string];
    if (!next[side].includes(nextBans[1 - side])) nextBans[1 - side] = "";
    setBans(nextBans);
  }
  function generate() {
    if (!ready) {
      setError("请先完成双方选曲和 Ban 曲。");
      return;
    }
    const retained = [
      ...new Set(
        picks
          .map((p, i) => p.find((s) => s !== bans[1 - i])!)
          .filter((s) => !bans.includes(s)),
      ),
    ];
    const available = pool.filter(
      (s) => !bans.includes(s.id) && !retained.includes(s.id),
    );
    while (retained.length < 2 && available.length) {
      retained.push(
        available.splice(
          crypto.getRandomValues(new Uint32Array(1))[0] % available.length,
          1,
        )[0].id,
      );
    }
    if (designated) retained.push("special:" + designated);
    setScores(retained.map((songId) => ({ songId, a: null, b: null })));
    setError("");
  }
  function extra() {
    const available = pool.filter(
      (s) => !bans.includes(s.id) && !scores.some((x) => x.songId === s.id),
    );
    if (!available.length) {
      setError("未禁用的曲目已全部使用，请联系裁判确认后续规则。");
      return;
    }
    const selected =
      available[
        crypto.getRandomValues(new Uint32Array(1))[0] % available.length
      ];
    setScores([...scores, { songId: selected.id, a: null, b: null }]);
  }
  async function submit(action: Action) {
    setSaving(true);
    setError("");
    try {
      const r = await fetch("/api/matches/" + match.id, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revision,
          ...(action.type === "bye" ? {} : { picks, bans, scores, station }),
          ...action,
        }),
      });
      const body = (await r.json()) as {
        error: string;
        match: Match;
        revision: number;
      };
      if (!r.ok) throw Error(body.error);
      onSaved(body.match, body.revision);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败，请重试。");
    } finally {
      setSaving(false);
      setConfirm(null);
    }
  }
  if (done)
    return (
      <div className="result-box">
        <Trophy size={26} />
        <h3>
          {match.winner === match.a?.id ? match.a?.name : match.b?.name}{" "}
          {match.round >= 3 ? "获胜" : "晋级"}
        </h3>
        <p>
          {match.status === "bye" ? "轮空直接晋级" : "结果已确认并更新对阵图。"}
        </p>
      </div>
    );
  return (
    <div className="editor">
      <div className="private-note">
        <Music2 size={15} />
        <span>双方各选择两首曲目，再各禁用对手一首。</span>
      </div>
      <div className="form-heading">
        <h3>
          01 <span>选曲与 Ban 曲</span>
        </h3>
        <span>双方各选 2 首</span>
      </div>
      <div className="pick-sides">
        {([0, 1] as const).map((side) => (
          <div className="pick-side" key={side}>
            <h4>{(side === 0 ? match.a : match.b)?.name ?? "等待晋级"}</h4>
            {[0, 1].map((i) => (
              <Picker
                key={i}
                label={`${side === 0 ? "A" : "B"} 方选曲 ${i + 1}`}
                value={picks[side][i] ?? ""}
                onChange={(v) => changePick(side, i, v)}
                disabled={match.status === "live"}
                options={pool.map((s) => ({
                  value: s.id,
                  label: `${s.title}${s.ura ? "（里）" : ""} · ★${s.stars}`,
                  disabled:
                    picks[side][1 - i] === s.id ||
                    usedSongs(
                      tournament,
                      match,
                      (side === 0 ? match.a : match.b)?.id ?? "",
                    ).has(s.id),
                }))}
              />
            ))}
            <Picker
              label={`${side === 0 ? "A" : "B"} 方 Ban 对手曲目`}
              value={bans[side]}
              disabled={match.status === "live"}
              onChange={(v) => {
                const b = [...bans] as [string, string];
                b[side] = v;
                setBans(b);
                setScores([]);
              }}
              options={picks[1 - side]
                .filter(Boolean)
                .map((s) => ({ value: s, label: songName(match.group, s) }))}
            />
          </div>
        ))}
      </div>
      <div className="editor-inline">
        <Picker
          label="比赛机台"
          value={station}
          onChange={setStation}
          disabled={match.status === "live"}
          options={[
            { value: "A", label: "A 台" },
            { value: "B", label: "B 台" },
          ]}
        />
        <button
          className="secondary-button"
          disabled={saving || !ready || match.status === "live"}
          onClick={generate}
        >
          <Shuffle size={16} />
          生成比赛曲目
        </button>
      </div>
      <div className="form-heading">
        <h3>
          02 <span>成绩录入</span>
        </h3>
        <span>{match.round >= 3 ? "三首总分制" : "两首总分制"}</span>
      </div>
      {scores.length === 0 ? (
        <p className="form-help">
          选曲完成后生成曲目；选曲重复时自动随机补足。每首成绩由裁判手动填写。
        </p>
      ) : (
        <>
          <div className="score-column-head">
            <span>课题曲</span>
            <span>{match.a?.name}</span>
            <span>{match.b?.name}</span>
          </div>
          {scores.map((s, i) => (
            <div className="score-input-row" key={s.songId}>
              <div>
                <small>
                  {String(i + 1).padStart(2, "0")} ·{" "}
                  {s.songId.startsWith("special:")
                    ? "指定曲"
                    : i >= (match.round >= 3 ? 3 : 2)
                      ? "加赛曲"
                      : "比赛曲"}
                </small>
                <span>{songName(match.group, s.songId)}</span>
              </div>
              {(["a", "b"] as const).map((side) => (
                <input
                  key={side}
                  aria-label={`${songName(match.group, s.songId)} ${side === "a" ? match.a?.name : match.b?.name}成绩`}
                  inputMode="numeric"
                  type="number"
                  min="0"
                  max="2000000"
                  step="1"
                  value={s[side] ?? ""}
                  placeholder="待录入"
                  onChange={(e) => {
                    const next = structuredClone(scores);
                    next[i][side] =
                      e.target.value === "" ? null : Number(e.target.value);
                    setScores(next);
                  }}
                />
              ))}
            </div>
          ))}
          <div className="total-row">
            <b>总分</b>
            <strong>{sum[0].toLocaleString()}</strong>
            <strong>{sum[1].toLocaleString()}</strong>
          </div>
          <button className="text-button" onClick={extra} disabled={saving}>
            <Shuffle size={14} />
            平分加赛 · 抽取一首
          </button>
        </>
      )}
      <div className="editor-actions">
        {match.status === "pending" ? (
          <>
            <button
              className="secondary-button"
              disabled={saving || !ready}
              onClick={() => submit({ type: "draft" })}
            >
              <Save size={16} />
              保存选曲
            </button>
            <button
              className="primary-button"
              disabled={saving || !scores.length}
              onClick={() => submit({ type: "start" })}
            >
              <Radio size={16} />
              开始比赛
            </button>
          </>
        ) : (
          <>
            <button
              className="secondary-button"
              disabled={saving}
              onClick={() => submit({ type: "save" })}
            >
              <Save size={16} />
              保存比分
            </button>
            <button
              className="primary-button"
              disabled={
                saving ||
                !scores.length ||
                scores.some((s) => s.a === null || s.b === null) ||
                sum[0] === sum[1]
              }
              onClick={() => setConfirm({ type: "finish" })}
            >
              <Check size={16} />
              确认赛果
            </button>
          </>
        )}
      </div>
      {scores.length > 0 &&
        scores.every((s) => s.a !== null && s.b !== null) &&
        sum[0] === sum[1] && (
          <p className="form-help">
            双方总分相同，请抽取加赛曲目后再确认赛果。
          </p>
        )}
      <div className="bye-area">
        <h3>轮空 / 对手缺席</h3>
        <p>指定一位选手直接晋级，无需填写成绩。</p>
        <Picker
          label="直接晋级的选手"
          value={bye}
          onChange={setBye}
          options={[match.a, match.b]
            .filter((p) => p !== null)
            .map((p) => ({ value: p.id, label: p.name }))}
        />
        <button
          className="text-button"
          disabled={!bye || saving}
          onClick={() => setConfirm({ type: "bye", winner: bye })}
        >
          设置轮空晋级
          <ChevronRight size={15} />
        </button>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <AlertDialog
        open={!!confirm}
        onOpenChange={(v) => !v && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.type === "bye" ? "确认轮空晋级？" : "确认本场赛果？"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.type === "bye"
                ? [match.a, match.b].find((p) => p?.id === bye)?.name
                : sum[0] > sum[1]
                  ? match.a?.name
                  : match.b?.name}{" "}
              将{match.round >= 3 ? "获胜" : "晋级下一轮"}
              。确认后立即更新公开对阵图，本地 demo 暂不支持撤销已确认的赛果。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>返回检查</AlertDialogCancel>
            <AlertDialogAction
              className="primary-button"
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                if (confirm) void submit(confirm);
              }}
            >
              {saving ? "正在保存…" : "确认并更新对阵"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
