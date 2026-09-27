import { z } from 'zod';
import { RuleError } from './rules';
import { stampMatchRevisions, hydrateTournament, tournamentState, type Match, type Tournament } from './tournament';

const profile = {
  name: z.string().trim().min(1).max(60),
  rating: z.number().finite().min(0).max(100).refine(v => Math.abs(v * 100 - Math.round(v * 100)) < 1e-8),
};
export const playerAction = z.discriminatedUnion('type', [
  z.object({ type: z.literal('edit'), id: z.string(), ...profile }).strict(),
  z.object({ type: z.literal('add'), group: z.enum(['siamese', 'tabby', 'ragdoll']), ...profile }).strict(),
  z.object({ type: z.literal('replace'), matchId: z.string(), side: z.enum(['a', 'b']), playerId: z.string() }).strict(),
]);
export type PlayerAction = z.infer<typeof playerAction>;

export function canReplace(m: Match) {
  return m.round === 0 && m.status === 'pending' && !m.published && !m.winner &&
    m.scores.every(s => s.a === null && s.b === null);
}

export function reserves(t: Tournament, group: keyof Tournament['rosters']) {
  const playing = new Set(t.matches.filter(m => m.group === group && m.round === 0)
    .flatMap(m => [m.a?.id, m.b?.id]));
  return t.rosters[group].filter(p => !playing.has(p.id));
}

export function applyPlayerAction(t: Tournament, input: unknown): Tournament {
  const parsed = playerAction.safeParse(input);
  if (!parsed.success) throw new RuleError('选手资料无效：姓名需为 1～60 字，rating 为 0～100 且最多两位小数。');
  const action = parsed.data;
  const next = structuredClone(t);
  if (action.type === 'edit') {
    const player = Object.values(next.rosters).flat().find(p => p.id === action.id);
    if (!player) throw new RuleError('选手不存在。', 404);
    player.name = action.name;
    player.rating = action.rating;
  } else if (action.type === 'add') {
    const roster = next.rosters[action.group];
    if (roster.length >= 128) throw new RuleError('本组选手数量已达上限。');
    roster.push({ id: `${action.group}-${crypto.randomUUID()}`, name: action.name, rating: action.rating,
      seed: Math.max(0, ...roster.map(p => p.seed)) + 1 });
  } else {
    const match = next.matches.find(m => m.id === action.matchId);
    if (!match) throw new RuleError('比赛不存在。', 404);
    const incoming = next.rosters[match.group].find(p => p.id === action.playerId);
    if (!incoming) throw new RuleError('只能选择本组已预设的选手。');
    const outgoing = match[action.side];
    if (outgoing?.id === incoming.id) throw new RuleError('这位选手已经在当前位置。');
    const source = next.matches.find(m => m.round === 0 && m.group === match.group &&
      (m.a?.id === incoming.id || m.b?.id === incoming.id));
    const affected = [...new Set([match, ...(source ? [source] : [])])];
    if (affected.some(m => !canReplace(m)))
      throw new RuleError('只能调整尚未开始且未录分的首轮比赛；交换的另一场比赛也必须满足条件。');
    const ids = new Set([incoming.id, outgoing?.id]);
    if (next.matches.some(m => m.round > 0 && ((m.a && ids.has(m.a.id)) || (m.b && ids.has(m.b.id)))))
      throw new RuleError('选手已进入后续轮次，不能调整首轮位置。');
    if (source) {
      const side = source.a?.id === incoming.id ? 'a' : 'b';
      source[side] = outgoing ? { ...outgoing, seed: source[side]!.seed } : null;
    }
    match[action.side] = { ...incoming, seed: outgoing?.seed ?? match.index * 2 + (action.side === 'a' ? 1 : 2) };
    for (const m of affected) {
      // Picks and bans belong to the former pairing, so unplayed drafts are cleared.
      m.picks = [[], []]; m.bans = ['', '']; m.scores = [];
      m.updatedAt = new Date().toISOString();
    }
  }
  next.revision = t.revision + 1;
  next.updatedAt = new Date().toISOString();
  return stampMatchRevisions(t, hydrateTournament(tournamentState(next)));
}
