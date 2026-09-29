import { z } from 'zod';
import type { StoredTournament } from './tournament';
import type { CenturyLink } from './centurylink';
import type { TournamentRow } from './database';

const revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const group = z.enum(['siamese', 'tabby', 'ragdoll']);
const ref = z.object({ id: z.string().min(1), seed: z.number().int().positive() }).strict().nullable();
const player = z.object({ id: z.string().min(1), name: z.string(), seed: z.number().int().positive(), rating: z.number().finite() }).strict();
const stateSchema = z.object({
  revision, updatedAt: z.string(),
  rosters: z.object({ siamese: z.array(player), tabby: z.array(player), ragdoll: z.array(player) }).strict(),
  matches: z.array(z.object({
    id: z.string().min(1), revision: revision.optional(), group,
    round: z.number().int().nonnegative(), index: z.number().int().nonnegative(),
    a: ref, b: ref, status: z.enum(['pending', 'live', 'complete', 'bye']),
    winner: z.string().nullable(), station: z.string(), published: z.boolean(),
    picks: z.tuple([z.array(z.string()), z.array(z.string())]), bans: z.tuple([z.string(), z.string()]),
    scores: z.array(z.object({ songId: z.string(), a: z.number().int().nonnegative().nullable(), b: z.number().int().nonnegative().nullable() }).strict()),
    updatedAt: z.string().nullable(),
  }).strict()),
}).strict();

const clSongs = z.array(z.string());
const clStateSchema = z.object({
  format: z.literal('centurylink'), revision, updatedAt: z.string(),
  players: z.array(z.object({ id: z.string().min(1), name: z.string(), rankingScore: z.number().int().nonnegative().nullable() }).strict()),
  ranking: z.object({ status: z.enum(['pending', 'live', 'complete']), seeds: z.array(z.string()), updatedAt: z.string().nullable() }).strict(),
  matches: z.array(z.object({
    id: z.string().min(1), revision: revision.optional(), group: z.literal('main'),
    round: z.number().int().min(1).max(3), index: z.number().int().positive(),
    a: z.string().nullable(), b: z.string().nullable(), status: z.enum(['pending', 'live', 'complete', 'bye']),
    winner: z.string().nullable(), station: z.string(), published: z.boolean(),
    bans: z.tuple([clSongs, clSongs]), picks: z.tuple([clSongs, clSongs]),
    scores: z.array(z.object({ songId: z.string(), a: z.number().int().nonnegative().nullable(), b: z.number().int().nonnegative().nullable() }).strict()),
    updatedAt: z.string().nullable(),
  }).strict()),
}).strict();

export type TournamentDocument = {
  _id: string; schemaVersion: 3; revision: number; updatedAt: string;
  groups: string[]; participantCount: number; matchCount: number;
  maintenance?: boolean;
  // Formats other than the original HachiCats layout keep event-level state here.
  format?: 'centurylink'; ranking?: CenturyLink['ranking'];
};
export type ParticipantDocument = Omit<StoredTournament['rosters']['siamese'][number], 'id'> & {
  _id: string; tournamentId: string; playerId: string; groupId: string; rosterOrder: number;
};
export type MatchDocument = Omit<StoredTournament['matches'][number], 'id'> & {
  _id: string; tournamentId: string; matchId: string; matchOrder: number;
};
// An unambiguous compound physical key. Public player/match IDs never change.
export const documentKey = (tournamentId: string, id: string) => JSON.stringify([tournamentId, id]);
const insist = (ok: unknown) => { if (!ok) throw new Error('Invalid tournament storage structure'); };

export function validateCenturyLink(value: unknown, expectedRevision: number): CenturyLink {
  const result = clStateSchema.safeParse(value);
  if (!result.success) throw new Error('Invalid tournament storage structure');
  const state = result.data;
  insist(state.revision === expectedRevision);
  const players = new Set(state.players.map(p => p.id));
  insist(players.size === state.players.length);
  insist(new Set(state.matches.map(m => m.id)).size === state.matches.length);
  insist(new Set(state.matches.map(m => m.index)).size === state.matches.length);
  insist(state.ranking.seeds.every(id => players.has(id)) && new Set(state.ranking.seeds).size === state.ranking.seeds.length);
  for (const m of state.matches) {
    insist((m.revision ?? 0) <= state.revision);
    for (const slot of [m.a, m.b]) if (slot) insist(players.has(slot));
    insist(m.winner === null || m.winner === m.a || m.winner === m.b);
  }
  return value as CenturyLink;
}
const isCenturyLink = (value: unknown) => !!value && typeof value === 'object' && (value as { format?: unknown }).format === 'centurylink';

export function validateStoredTournament(value: unknown, expectedRevision: number): StoredTournament | CenturyLink {
  if (isCenturyLink(value)) return validateCenturyLink(value, expectedRevision);
  const result = stateSchema.safeParse(value);
  if (!result.success) throw new Error('Invalid tournament storage structure');
  const state = result.data;
  insist(state.revision === expectedRevision);
  const players = new Map(Object.entries(state.rosters).flatMap(([g, rows]) => rows.map(p => [p.id, g] as const)));
  insist(players.size === Object.values(state.rosters).flat().length);
  insist(new Set(state.matches.map(m => m.id)).size === state.matches.length);
  insist(new Set(state.matches.map(m => JSON.stringify([m.group, m.round, m.index]))).size === state.matches.length);
  for (const m of state.matches) {
    insist((m.revision ?? 0) <= state.revision);
    for (const slot of [m.a, m.b]) if (slot) insist(players.get(slot.id) === m.group);
    insist(m.winner === null || m.winner === m.a?.id || m.winner === m.b?.id);
  }
  // Return the original object: migration must not normalize missing fields or legacy song IDs.
  return value as StoredTournament;
}

function splitCenturyLink(row: TournamentRow, state: CenturyLink) {
  const participants: ParticipantDocument[] = state.players.map(({ id, ...profile }, rosterOrder) => ({
    ...profile, _id: documentKey(row.id, id), tournamentId: row.id, playerId: id, groupId: 'main', rosterOrder,
  })) as unknown as ParticipantDocument[];
  const matches = state.matches.map(({ id, ...match }, matchOrder) => ({
    ...match, _id: documentKey(row.id, id), tournamentId: row.id, matchId: id, matchOrder,
  })) as unknown as MatchDocument[];
  const tournament: TournamentDocument = { _id: row.id, schemaVersion: 3, format: 'centurylink', revision: row.revision,
    updatedAt: state.updatedAt, groups: ['main'], participantCount: participants.length, matchCount: matches.length, ranking: state.ranking };
  return { tournament, participants, matches };
}

function joinCenturyLink(meta: TournamentDocument, participants: ParticipantDocument[], matches: MatchDocument[]): TournamentRow {
  insist(meta.groups.length === 1 && meta.groups[0] === 'main' && !!meta.ranking);
  const players = [...participants].sort((a, b) => a.rosterOrder - b.rosterOrder).map((row, index) => {
    const { _id, tournamentId, playerId, groupId, rosterOrder, ...profile } = row as unknown as Record<string, unknown> & ParticipantDocument;
    insist(tournamentId === meta._id && _id === documentKey(meta._id, playerId) && rosterOrder === index && groupId === 'main');
    return { id: playerId, ...profile };
  });
  const restored = [...matches].sort((a, b) => a.matchOrder - b.matchOrder).map((row, index) => {
    const { _id, tournamentId, matchId, matchOrder, ...match } = row;
    insist(tournamentId === meta._id && _id === documentKey(meta._id, matchId) && matchOrder === index);
    return { id: matchId, ...match };
  });
  const state = validateCenturyLink({ format: 'centurylink', revision: meta.revision, updatedAt: meta.updatedAt, players, ranking: meta.ranking, matches: restored }, meta.revision);
  return { id: meta._id, revision: meta.revision, body: JSON.stringify(state) };
}

export function splitTournament(row: TournamentRow) {
  const parsed = validateStoredTournament(JSON.parse(row.body), row.revision);
  if ('format' in parsed) return splitCenturyLink(row, parsed);
  const state = parsed;
  const groups = Object.keys(state.rosters);
  const participants: ParticipantDocument[] = Object.entries(state.rosters).flatMap(([groupId, players]) =>
    players.map(({ id, ...profile }, rosterOrder) => ({ ...profile, _id: documentKey(row.id, id), tournamentId: row.id, playerId: id, groupId, rosterOrder })));
  const matches: MatchDocument[] = state.matches.map(({ id, ...match }, matchOrder) => ({
    ...match, _id: documentKey(row.id, id), tournamentId: row.id, matchId: id, matchOrder,
  }));
  const tournament: TournamentDocument = { _id: row.id, schemaVersion: 3, revision: row.revision,
    updatedAt: state.updatedAt, groups, participantCount: participants.length, matchCount: matches.length };
  return { tournament, participants, matches };
}

export function joinTournament(meta: TournamentDocument, participants: ParticipantDocument[], matches: MatchDocument[]): TournamentRow {
  insist(meta.schemaVersion === 3 && participants.length === meta.participantCount && matches.length === meta.matchCount);
  if (meta.format === 'centurylink') return joinCenturyLink(meta, participants, matches);
  insist(meta.format === undefined);
  insist(new Set(meta.groups).size === meta.groups.length && meta.groups.every(g => ['siamese', 'tabby', 'ragdoll'].includes(g)));
  const rosters = Object.fromEntries(meta.groups.map(g => [g, []])) as unknown as StoredTournament['rosters'];
  for (const g of meta.groups) {
    const rows = participants.filter(p => p.groupId === g).sort((a, b) => a.rosterOrder - b.rosterOrder);
    for (const [index, row] of rows.entries()) {
      const { _id, tournamentId, playerId, groupId, rosterOrder, ...profile } = row;
      insist(tournamentId === meta._id && _id === documentKey(meta._id, playerId) && rosterOrder === index);
      rosters[groupId as keyof typeof rosters].push({ id: playerId, ...profile });
    }
  }
  insist(Object.values(rosters).flat().length === participants.length);
  const restored = [...matches].sort((a, b) => a.matchOrder - b.matchOrder).map((row, index) => {
    const { _id, tournamentId, matchId, matchOrder, ...match } = row;
    insist(tournamentId === meta._id && _id === documentKey(meta._id, matchId) && matchOrder === index);
    return { id: matchId, ...match };
  });
  const state = validateStoredTournament({ rosters, revision: meta.revision, updatedAt: meta.updatedAt, matches: restored }, meta.revision);
  return { id: meta._id, revision: meta.revision, body: JSON.stringify(state) };
}
