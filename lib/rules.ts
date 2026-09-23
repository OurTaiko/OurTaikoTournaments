import {
  advance,
  songs,
  totals,
  type Match,
  type Tournament,
} from "./tournament";
export class RuleError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
export type Action = {
  type: "draft" | "start" | "save" | "finish" | "bye";
  picks?: [string[], string[]];
  bans?: [string, string];
  station?: string;
  scores?: Match["scores"];
  winner?: string;
  published?: boolean;
};
const insist = (ok: unknown, message: string) => {
  if (!ok) throw new RuleError(message);
};
export function usedSongs(t: Tournament, m: Match, playerId: string) {
  return new Set(
    t.matches
      .filter(
        (n) =>
          n.id !== m.id &&
          n.group === m.group &&
          n.status === "complete" &&
          (n.a?.id === playerId || n.b?.id === playerId),
      )
      .flatMap((n) =>
        n.picks[n.a?.id === playerId ? 0 : 1].filter((id) =>
          n.scores.some((s) => s.songId === id),
        ),
      ),
  );
}
export function applyAction(
  t: Tournament,
  id: string,
  action: Action,
): Tournament {
  const next = structuredClone(t);
  const m = next.matches.find((m) => m.id === id);
  insist(m, "找不到这场比赛。");
  if (!m) throw new RuleError("找不到比赛。", 404);
  insist(
    !["complete", "bye"].includes(m.status),
    "已确认的比赛不能直接修改，以免影响后续对阵。",
  );
  if (action.type === "bye") {
    if (m.round > 0) {
      const sources = next.matches.filter(
        (n) =>
          n.group === m.group &&
          n.round === (m.round === 4 ? 2 : m.round - 1) &&
          (m.round >= 3 || Math.floor(n.index / 2) === m.index),
      );
      insist(
        sources.every((n) => ["complete", "bye"].includes(n.status)),
        "上一轮比赛结束后才能设置轮空。",
      );
    }
    insist(
      action.winner && (m.a?.id === action.winner || m.b?.id === action.winner),
      "请选择实际参赛的晋级选手。",
    );
    m.winner = action.winner!;
    m.status = "bye";
    m.scores = [];
    m.picks = [[], []];
    m.bans = ["", ""];
    m.published = true;
    advance(next.matches, m);
  } else {
    insist(m.a && m.b, "双方选手到位后才能开始比赛。");
    if (action.picks !== undefined) {
      insist(
        Array.isArray(action.picks) && action.picks.length === 2,
        "选曲数据格式不正确。",
      );
      for (const [i, p] of action.picks.entries()) {
        insist(
          Array.isArray(p) && p.length === 2 && new Set(p).size === 2,
          "每位选手需选择两首不同曲目。",
        );
        for (const s of p) {
          insist(
            songs[m.group].some((x) => x.id === s),
            "只能选择本组曲库中的曲目。",
          );
          insist(
            !usedSongs(t, m, (i === 0 ? m.a : m.b)!.id).has(s),
            "不能重复选择该选手此前已游玩的曲目。",
          );
        }
      }
      m.picks = action.picks;
    }
    if (action.bans !== undefined) {
      insist(
        Array.isArray(action.bans) && action.bans.length === 2,
        "Ban 曲数据格式不正确。",
      );
      action.bans.forEach((s, i) =>
        insist(
          m.picks[1 - i].includes(s),
          "每位选手需禁用对手选择的一首曲目。",
        ),
      );
      m.bans = action.bans;
    }
    if (action.station !== undefined) {
      insist(["A", "B"].includes(action.station), "请选择 A 台或 B 台。");
      m.station = action.station;
    }
    if (action.scores !== undefined) {
      insist(
        Array.isArray(action.scores) && action.scores.length <= 20,
        "成绩数据格式不正确。",
      );
      for (const s of action.scores) {
        insist(
          typeof s.songId === "string" &&
            (songs[m.group].some((x) => x.id === s.songId) ||
              (m.round >= 3 &&
                s.songId.startsWith("special:") &&
                s.songId.length > 8 &&
                s.songId.length < 160)),
          "曲目不在当前曲库中。",
        );
        for (const v of [s.a, s.b])
          insist(
            v === null || (Number.isSafeInteger(v) && v >= 0 && v <= 2000000),
            "成绩需为 0～2,000,000 的整数。",
          );
        insist(!m.bans.includes(s.songId), "禁用曲目不能作为比赛曲目。");
      }
      insist(
        new Set(action.scores.map((s) => s.songId)).size ===
          action.scores.length,
        "比赛曲目不能重复。",
      );
      m.scores = action.scores;
    }
    if (
      action.type === "start" ||
      action.type === "save" ||
      action.type === "finish"
    ) {
      insist(
        m.picks.every((p) => p.length === 2) && m.bans.every(Boolean),
        "请先完成双方各两首选曲和 Ban 曲。",
      );
      const remaining = m.picks.map((p, i) =>
        p.find((s) => s !== m.bans[1 - i])!,
      );
      insist(
        remaining.every((s) => m.scores.some((x) => x.songId === s)),
        "成绩表必须包含双方保留的曲目。",
      );
      const regular = m.scores.filter((s) => !s.songId.startsWith("special:"));
      insist(regular.length >= 2, "重复选曲时，请抽取一首补充曲目。");
      insist(
        m.scores.filter((s) => s.songId.startsWith("special:")).length ===
          (m.round >= 3 ? 1 : 0),
        "决赛和季军赛需要一首指定曲。",
      );
      if (action.type === "start") {
        insist(
          !next.matches.some(
            (n) =>
              n.id !== id && n.status === "live" && n.station === m.station,
          ),
          `${m.station} 台已有正在进行的比赛。`,
        );
        m.status = "live";
        m.published = true;
      }
      if (action.type === "save") {
        insist(m.status === "live", "请先开始比赛，再保存公开比分。");
        m.published = true;
      }
      if (action.type === "finish") {
        insist(
          m.scores.every((s) => s.a !== null && s.b !== null),
          "请填完所有曲目的双方成绩。",
        );
        const [a, b] = totals(m);
        insist(a !== b, "总分相同，请抽取加赛曲目并录入成绩。");
        m.winner = a > b ? m.a!.id : m.b!.id;
        m.status = "complete";
        m.published = true;
        advance(next.matches, m);
      }
    } else insist(action.type === "draft", "未知操作。");
  }
  m.updatedAt = new Date().toISOString();
  next.updatedAt = m.updatedAt;
  next.revision = t.revision + 1;
  return next;
}
