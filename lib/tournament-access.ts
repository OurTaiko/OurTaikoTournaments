import 'server-only';
import { viewer, type Viewer } from './auth';
import { tournamentDefinition, type TournamentScope } from './tournament-scope';
import { db } from './store';
import { tournamentStorageId } from './tournament-scope';
import { RuleError } from './rules';

/** Input must come from viewer(), which verifies this application's token with SSO. */
export async function canManageTournament(scope: TournamentScope, user: Viewer | null) {
  tournamentDefinition(scope.tournamentId);
  if (!user) return false;
  // A loopback demo identity is never a configured SSO account or a production admin.
  if (user.demo) return scope.demo && user.admin;
  if (user.admin) return true;
  const people = await db().getTournamentPeople(tournamentStorageId(scope));
  return !!people && (people.organizers.includes(user.username) || people.admins.includes(user.username));
}

export async function requireTournamentAdmin(req: Request, scope: TournamentScope) {
  tournamentDefinition(scope.tournamentId);
  // Do not require the global SSO admin role before checking event-scoped grants.
  const user = await viewer(req);
  if (!user) throw new RuleError('请先登录。', 401);
  if (!await canManageTournament(scope, user)) throw new RuleError('当前账号没有此赛事的管理权限。', 403);
  return user;
}
