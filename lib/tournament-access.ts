import { requireAdmin, type Viewer } from './auth';
import { tournamentDefinition, type TournamentScope } from './tournament-scope';
import { RuleError } from './rules';

/** The old SSO role is granted to HachiCats explicitly, never to every event. */
export function canManageTournament(scope: TournamentScope, user: Viewer | null) {
  const definition = tournamentDefinition(scope.tournamentId);
  return definition.authorization === 'existing-hachicats-sso-role' && !!user?.admin && (!user.demo || scope.demo);
}

export async function requireTournamentAdmin(req: Request, scope: TournamentScope) {
  tournamentDefinition(scope.tournamentId);
  const user = await requireAdmin(req);
  if (!canManageTournament(scope, user)) throw new RuleError('当前账号没有此赛事的管理权限。', 403);
  return user;
}
