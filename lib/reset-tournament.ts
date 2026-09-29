import { hachicatsScope, isCenturyLinkScope, tournamentStorageId, type TournamentScope } from './tournament-scope';
import { makeTournament } from "./tournament-seed";
import type { Database } from './database';
import { RuleError } from './rules';
import { hydrateTournament, tournamentState, type StoredTournament, type Tournament } from './tournament';
import { makeCenturyLink, type CenturyLink } from './centurylink';
import { validateCenturyLink } from './tournament-documents';
import { resetConfirmation } from './reset-confirmation';

export async function resetTournament(database: Database, demo: boolean, input: unknown, actor: string, scope: TournamentScope = hachicatsScope(demo)) {
  if (!input || typeof input !== 'object') throw new RuleError('重置请求无效。');
  const { confirmation, revision } = input as { confirmation?: unknown; revision?: unknown };
  if (confirmation !== resetConfirmation(demo, scope.tournamentId)) throw new RuleError('请输入完整的重置确认文字。');
  if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0 || revision >= Number.MAX_SAFE_INTEGER)
    throw new RuleError('赛事版本无效，请刷新后重试。');
  if (scope.demo !== demo) throw new RuleError('赛事环境不匹配。');
  const id = tournamentStorageId(scope);
  const current = await database.getTournament(id);
  if (!current) throw new RuleError('未找到赛事，无法重置。', 404);
  if (current.revision !== revision) throw new RuleError('赛况已更新，请重新查看赛事后再次确认重置。', 409);
  let next: Tournament | CenturyLink, body: string;
  if (isCenturyLinkScope(scope)) {
    // Keep the roster (nicknames and order); clear ranking scores, seeds and every match.
    const players = validateCenturyLink(JSON.parse(current.body), current.revision).players.map(p => ({ ...p, rankingScore: null }));
    const reset = makeCenturyLink(players);
    reset.revision = revision + 1;
    for (const match of reset.matches) match.revision = reset.revision;
    next = reset;
    body = JSON.stringify(reset);
  } else {
    const roster = hydrateTournament(JSON.parse(current.body) as StoredTournament).rosters;
    const reset = makeTournament(false, roster);
    reset.revision = revision + 1;
    // Invalidate every open editor, including untouched first-round matches.
    for (const match of reset.matches) match.revision = reset.revision;
    next = reset;
    body = JSON.stringify(tournamentState(reset));
  }
  const backupId = crypto.randomUUID();
  const backup = { ...current, id: backupId, tournamentId: id, createdAt: new Date().toISOString(), actor };
  const row = { id, revision: next.revision, body };
  // Atlas commits the snapshot and every affected document atomically.
  // SQLite/D1 retain backup-before-CAS with the existing whole-state storage.
  let updated: boolean;
  if (database.updateTournamentWithBackup) {
    updated = await database.updateTournamentWithBackup(row, revision, backup);
  } else {
    await database.saveTournamentBackup(backup);
    updated = await database.updateTournament(row, revision);
  }
  if (!updated)
    throw new RuleError('赛况已更新，本次未重置，请重新确认。', 409);
  return { tournament: next, backupId };
}
