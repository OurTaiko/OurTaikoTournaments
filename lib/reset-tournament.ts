import { makeTournament } from "./tournament-seed";
import type { Database } from './database';
import { RuleError } from './rules';
import { hydrateTournament, tournamentState, type StoredTournament } from './tournament';
import { resetConfirmation } from './reset-confirmation';

export async function resetTournament(database: Database, demo: boolean, input: unknown, actor: string) {
  if (!input || typeof input !== 'object') throw new RuleError('重置请求无效。');
  const { confirmation, revision } = input as { confirmation?: unknown; revision?: unknown };
  if (confirmation !== resetConfirmation(demo)) throw new RuleError('请输入完整的重置确认文字。');
  if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0 || revision >= Number.MAX_SAFE_INTEGER)
    throw new RuleError('赛事版本无效，请刷新后重试。');
  const id = demo ? 'demo' : 'edition-1';
  const current = await database.getTournament(id);
  if (!current) throw new RuleError('未找到赛事，无法重置。', 404);
  if (current.revision !== revision) throw new RuleError('赛况已更新，请重新查看赛事后再次确认重置。', 409);
  const roster = hydrateTournament(JSON.parse(current.body) as StoredTournament).rosters;
  const next = makeTournament(false, roster);
  next.revision = revision + 1;
  // Invalidate every open editor, including untouched first-round matches.
  for (const match of next.matches) match.revision = next.revision;
  const backupId = crypto.randomUUID();
  // Preserve the exact prior state before attempting the conditional write.
  // A racing update can leave an unused backup, but cannot be overwritten.
  await database.saveTournamentBackup({ ...current, id: backupId, tournamentId: id, createdAt: new Date().toISOString(), actor });
  if (!await database.updateTournament({ id, revision: next.revision, body: JSON.stringify(tournamentState(next)) }, revision))
    throw new RuleError('赛况已更新，本次未重置，请重新确认。', 409);
  return { tournament: next, backupId };
}
