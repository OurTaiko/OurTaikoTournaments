import { z } from "zod";
import { RuleError } from "./rules";
import {
  CL_PLAYER_COUNT, clAdvance, clBanCount, clDecision, clDefinition, clDesignatedFor, clDrawCount,
  clPickCount, clPlayedSongs, clPools, clSeedFirstRound, clSpecialId, isSpecial, stampClRevisions,
  type CenturyLink, type ClMatch,
} from "./centurylink";

export type ClAction = {
  type: "draft" | "start" | "save" | "finish" | "bye";
  bans?: ClMatch["bans"];
  picks?: ClMatch["picks"];
  station?: string;
  scores?: ClMatch["scores"];
  winner?: string;
};
const insist = (ok: unknown, message: string) => { if (!ok) throw new RuleError(message); };
const sides = [0, 1] as const;

function sourcesFinished(t: CenturyLink, m: ClMatch) {
  const definition = clDefinition(m.id);
  return [definition.a, definition.b].every(source => {
    if ("seed" in source) return t.ranking.status === "complete";
    const id = "winner" in source ? source.winner : source.loser;
    return ["complete", "bye"].includes(t.matches.find(n => n.id === id)!.status);
  });
}

/** Pool songs that may be picked: not banned, and not already played in this stage. */
export function clPickable(t: CenturyLink, m: ClMatch, bans: ClMatch["bans"]) {
  // Both players perform every song, so neither may have played it in this stage.
  const played = new Set([m.a, m.b].flatMap(p => p ? [...clPlayedSongs(t, m, p)] : []));
  return clPools[m.round].filter(id => !bans.flat().includes(id) && !played.has(id));
}
/** Songs that may be drawn: not banned, not already on the sheet, not played in this stage by either player. */
export function clDrawable(t: CenturyLink, m: ClMatch, bans: ClMatch["bans"], scores: ClMatch["scores"]) {
  return clPickable(t, m, bans).filter(id => !scores.some(s => s.songId === id));
}
/** Number of leading songs fixed by the format before any tiebreak songs. */
export function clRegularCount(m: Pick<ClMatch, "id">) {
  const { kind } = clDefinition(m.id);
  return kind === "designated" ? 3 : kind === "points" ? 4 : 2;
}

/** Draw final-stage songs individually, including before play, stopping once decided. */
export function clCanDrawNext(m: Pick<ClMatch, "id" | "scores">) {
  return clDefinition(m.id).kind === "points" && m.scores.length < clDrawCount(m.id) &&
    clDecision(m) === null;
}

function validateClDraw(previous: ClMatch, scores: ClMatch["scores"]) {
  // Keep already stored sheets (including the former four-song draw) intact.
  insist(scores.length >= previous.scores.length && previous.scores.every((s, i) => s.songId === scores[i].songId),
    "已抽取的曲目不能删除、替换或调整顺序。");
  const added = scores.slice(previous.scores.length);
  insist(added.length <= 1, "决赛曲目须逐首抽取，每次只能增加一首。");
  if (!added.length) return;
  const before = { ...previous, scores: scores.slice(0, -1) };
  const song = added[0].songId;
  if (before.scores.length < clDrawCount(previous.id)) {
    insist(clCanDrawNext(before), "已决出胜负时不能继续抽曲。");
    insist(!isSpecial(song), "前四首须从决赛阶段曲库逐首抽取。");
  } else {
    insist(before.scores.every(s => s.a !== null && s.b !== null) && clDecision(before) === null,
      "比分持平且当前成绩完整时才能加入决胜曲或加赛曲。");
    insist(before.scores.length === clDrawCount(previous.id)
      ? song === clSpecialId(clDesignatedFor(previous.id)!) : !isSpecial(song),
      "四首后同分须先演奏本场决胜曲，之后同分再抽取加赛曲。");
  }
}

export function applyClAction(t: CenturyLink, id: string, action: ClAction): CenturyLink {
  const next = structuredClone(t);
  const m = next.matches.find(match => match.id === id);
  if (!m) throw new RuleError("比赛不存在。", 404);
  insist(!["complete", "bye"].includes(m.status), "已确认的比赛不能直接修改，以免影响后续对阵。");
  insist(m.a && m.b, "双方选手到位后才能开始比赛。");
  insist(sourcesFinished(t, m), "前置比赛结束后才能进行本场比赛。");
  if (action.type === "bye") {
    insist(action.winner && (m.a === action.winner || m.b === action.winner), "请选择实际参赛的获胜选手。");
    Object.assign(m, { winner: action.winner, status: "bye", scores: [], picks: [[], []], bans: [[], []], published: true });
    clAdvance(next, m);
  } else {
    const definition = clDefinition(id);
    const locked = m.status === "live" || (definition.kind === "points" && m.scores.length > 0);
    if (action.bans !== undefined) {
      insist(!locked || JSON.stringify(action.bans) === JSON.stringify(m.bans), "比赛开始或决赛抽曲后不能修改 Ban 曲。");
      insist(Array.isArray(action.bans) && action.bans.length === 2 && action.bans.every(Array.isArray), "Ban 曲数据格式不正确。");
      for (const side of sides) {
        insist(action.bans[side].length <= clBanCount(id, side), "Ban 曲数量超过规则限制。");
        insist(action.bans[side].every(song => clPools[m.round].includes(song)), "只能禁用本阶段曲库中的曲目。");
      }
      insist(new Set(action.bans.flat()).size === action.bans.flat().length, "双方不能禁用同一首曲目。");
      m.bans = action.bans;
    }
    if (action.picks !== undefined) {
      insist(!locked || JSON.stringify(action.picks) === JSON.stringify(m.picks), "比赛开始后不能修改选曲。");
      insist(Array.isArray(action.picks) && action.picks.length === 2 && action.picks.every(Array.isArray), "选曲数据格式不正确。");
      for (const side of sides) {
        insist(action.picks[side].length <= clPickCount(id), "选曲数量超过规则限制。");
        for (const song of action.picks[side])
          insist(clPickable(t, m, m.bans).includes(song), "只能选择本阶段曲库中未被禁用、且双方本阶段均未游玩过的曲目。");
      }
      insist(new Set(action.picks.flat()).size === action.picks.flat().length, "双方不能选择同一首曲目。");
      m.picks = action.picks;
    }
    if (action.station !== undefined) {
      insist(["A", "B"].includes(action.station), "请选择 A 台或 B 台。");
      m.station = action.station;
    }
    if (action.scores !== undefined) {
      insist(Array.isArray(action.scores) && action.scores.length <= 12, "成绩数据格式不正确。");
      const designated = clDesignatedFor(id);
      const played = new Set([m.a!, m.b!].flatMap(p => [...clPlayedSongs(t, m, p)]));
      for (const s of action.scores) {
        insist(s && typeof s.songId === "string", "成绩数据格式不正确。");
        insist(isSpecial(s.songId) ? designated !== null && s.songId === clSpecialId(designated) : clPools[m.round].includes(s.songId), "曲目不在本阶段曲库中。");
        insist(!m.bans.flat().includes(s.songId), "被禁用的曲目不能作为比赛曲目。");
        insist(isSpecial(s.songId) || !played.has(s.songId), "有选手本阶段已游玩过该曲目。");
        for (const v of [s.a, s.b])
          insist(v === null || (Number.isSafeInteger(v) && v >= 0 && v <= 2000000), "成绩需为 0～2,000,000 的整数。");
      }
      insist(new Set(action.scores.map(s => s.songId)).size === action.scores.length, "比赛曲目不能重复。");
      if (definition.kind === "points") {
        if (action.scores.length) for (const side of sides)
          insist(m.bans[side].length === clBanCount(id, side), "请先完成双方的 Ban 曲。");
        validateClDraw(t.matches.find(match => match.id === id)!, action.scores);
      }
      m.scores = action.scores.map(({ songId, a, b }) => ({ songId, a, b }));
    }
    if (action.type !== "draft") {
      insist(["start", "save", "finish"].includes(action.type), "未知操作。");
      for (const side of sides) {
        insist(m.bans[side].length === clBanCount(id, side), "请先完成双方的 Ban 曲。");
        insist(m.picks[side].length === clPickCount(id), "请先完成双方选曲。");
      }
      const regular = clRegularCount(m);
      insist(m.scores.length >= (definition.kind === "points" ? 1 : regular), "请先生成本场比赛曲目。");
      const head = m.scores.slice(0, regular).map(s => s.songId);
      if (definition.kind === "pickban") insist(head.every(song => m.picks.flat().includes(song)), "前两首须为双方所选曲目。");
      if (definition.kind === "designated")
        insist(m.picks.flat().every(song => head.slice(0, 2).includes(song)) && head[2] === clSpecialId(clDesignatedFor(id)!), "前两首须为双方所选曲目，第三首为指定曲。");
      if (definition.kind === "points")
        insist(head.every(song => !isSpecial(song)), `前 ${clDrawCount(id)} 首须为抽取曲目。`);
      if (definition.kind === "points") {
        const tiebreak = m.scores.findIndex(s => isSpecial(s.songId));
        insist(tiebreak === -1 || tiebreak === regular, "决胜曲须在四首抽取曲之后游玩。");
      } else insist(m.scores.slice(regular).every(s => !isSpecial(s.songId)), "加赛曲须从本阶段曲库抽取。");
      if (action.type === "start") {
        insist(m.status === "pending", "比赛已经开始。");
        insist(!next.matches.some(n => n.id !== id && n.status === "live" && n.station === m.station), `${m.station} 台已有正在进行的比赛。`);
        m.status = "live";
      }
      if (action.type === "save") insist(m.status === "live", "请先开始比赛，再保存公开比分。");
      m.published = true;
      if (action.type === "finish") {
        insist(m.status === "live", "请先开始比赛。");
        const decision = clDecision(m);
        insist(decision !== null, definition.kind === "points"
          ? "尚未决出胜负：先得 3 分者获胜，四曲后同分请加入决胜曲。"
          : "请填完所有曲目的双方成绩；总分相同时请抽取加赛曲目。");
        m.winner = decision === 0 ? m.a : m.b;
        m.status = "complete";
        clAdvance(next, m);
      }
    }
  }
  m.updatedAt = new Date().toISOString();
  next.updatedAt = m.updatedAt;
  next.revision = t.revision + 1;
  m.revision = next.revision;
  return stampClRevisions(t, next);
}

const name = z.string().trim().min(1).max(40);
export const clPlayerAction = z.discriminatedUnion("type", [
  z.object({ type: z.literal("add"), name }).strict(),
  z.object({ type: z.literal("edit"), id: z.string(), name }).strict(),
  z.object({ type: z.literal("remove"), id: z.string() }).strict(),
  z.object({ type: z.literal("move"), id: z.string(), offset: z.union([z.literal(-1), z.literal(1)]) }).strict(),
  z.object({ type: z.literal("ranking-scores"), scores: z.array(z.object({
    id: z.string(), score: z.number().int().min(0).max(2000000).nullable(),
  }).strict()).max(CL_PLAYER_COUNT) }).strict(),
  z.object({ type: z.literal("ranking-confirm"), order: z.array(z.string()).length(CL_PLAYER_COUNT) }).strict(),
  z.object({ type: z.literal("ranking-reopen") }).strict(),
]);
export type ClPlayerAction = z.infer<typeof clPlayerAction>;

const firstRound = ["G1", "G2", "G3", "G4"];
/** Seeds can change only while no first-round match has been started or drafted. */
export function clCanReopenRanking(t: CenturyLink) {
  return t.matches.filter(m => firstRound.includes(m.id)).every(m =>
    m.status === "pending" && !m.published && !m.scores.length && !m.bans.flat().length && !m.picks.flat().length);
}

export function applyClPlayerAction(t: CenturyLink, input: unknown): CenturyLink {
  const parsed = clPlayerAction.safeParse(input);
  if (!parsed.success) throw new RuleError("选手资料无效：昵称需为 1～40 字；排位分数为 0～2,000,000 的整数。");
  const action = parsed.data;
  const next = structuredClone(t);
  const player = (id: string) => {
    const found = next.players.find(p => p.id === id);
    if (!found) throw new RuleError("选手不存在。", 404);
    return found;
  };
  const rosterOpen = () => insist(next.ranking.status !== "complete", "排位已确认，不能再增减选手；如需替换请直接修改昵称。");
  if (action.type === "add") {
    rosterOpen();
    insist(next.players.length < CL_PLAYER_COUNT, `正赛最多 ${CL_PLAYER_COUNT} 位选手。`);
    insist(!next.players.some(p => p.name === action.name), "已有同名选手。");
    next.players.push({ id: `cl-${crypto.randomUUID()}`, name: action.name, rankingScore: null });
  } else if (action.type === "edit") {
    insist(!next.players.some(p => p.name === action.name && p.id !== action.id), "已有同名选手。");
    player(action.id).name = action.name;
  } else if (action.type === "remove") {
    rosterOpen();
    player(action.id);
    next.players = next.players.filter(p => p.id !== action.id);
  } else if (action.type === "move") {
    rosterOpen();
    const from = next.players.indexOf(player(action.id)), to = from + action.offset;
    insist(to >= 0 && to < next.players.length, "已经到达列表边界。");
    [next.players[from], next.players[to]] = [next.players[to], next.players[from]];
  } else if (action.type === "ranking-scores") {
    insist(next.ranking.status !== "complete", "排位已确认；如需修改请先撤回排位。");
    for (const row of action.scores) player(row.id).rankingScore = row.score;
    next.ranking.status = next.players.some(p => p.rankingScore !== null) ? "live" : "pending";
    next.ranking.updatedAt = new Date().toISOString();
  } else if (action.type === "ranking-confirm") {
    insist(next.ranking.status !== "complete", "排位已经确认。");
    insist(next.players.length === CL_PLAYER_COUNT, `需要恰好 ${CL_PLAYER_COUNT} 位正赛选手。`);
    insist(new Set(action.order).size === CL_PLAYER_COUNT && action.order.every(id => next.players.some(p => p.id === id)), "排位顺序须包含全部正赛选手。");
    const scores = action.order.map(id => player(id).rankingScore);
    insist(scores.every(score => score !== null), "请先录入全部选手的排位赛分数。");
    // Equal scores may be ordered by the tiebreak result; different scores must stay descending.
    insist(scores.every((score, i) => i === 0 || score! <= scores[i - 1]!), "排位顺序须按排位赛分数从高到低。");
    next.ranking = { status: "complete", seeds: action.order, updatedAt: new Date().toISOString() };
    clSeedFirstRound(next);
  } else {
    insist(next.ranking.status === "complete", "排位尚未确认。");
    insist(clCanReopenRanking(next), "首轮比赛已开始或已有选曲，不能撤回排位。");
    next.ranking = { status: "live", seeds: [], updatedAt: new Date().toISOString() };
    clSeedFirstRound(next);
  }
  next.revision = t.revision + 1;
  next.updatedAt = new Date().toISOString();
  return stampClRevisions(t, next);
}
