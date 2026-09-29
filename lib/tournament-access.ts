import { requireAdmin, type Viewer } from './auth';
import { tournamentDefinition, type TournamentScope } from './tournament-scope';
import { RuleError } from './rules';

/** The SSO client role is granted per registered event, never to every event implicitly. */
const clientRolePolicies: readonly string[] = ['existing-hachicats-sso-role', 'ourtaiko-tournaments-sso-role'];
export function canManageTournament(scope: TournamentScope, user: Viewer | null) {
  const definition = tournamentDefinition(scope.tournamentId);
  return clientRolePolicies.includes(definition.authorization) && !!user?.admin && (!user.demo || scope.demo);
}

export async function requireTournamentAdmin(req: Request, scope: TournamentScope) {
  tournamentDefinition(scope.tournamentId);
  const user = await requireAdmin(req);
  if (!canManageTournament(scope, user)) throw new RuleError('当前账号没有此赛事的管理权限。', 403);
  return user;
}
