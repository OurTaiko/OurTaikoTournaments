import { resolveTournamentScope, type TournamentScope } from '../tournament-scope';
import { tournaments } from '../tournaments';
import { RuleError } from '../rules';
import { errorResponse, isDemo } from '../store';

export type TournamentParams = { series: string; edition: string };
export async function withTournamentScope<P extends TournamentParams>(
  params: Promise<P>,
  action: (scope: TournamentScope, params: P) => Promise<Response>,
) {
  try {
    const resolved = await params;
    // Resolve the exact pair; never infer a storage key by concatenating URL segments.
    const tournament = tournaments.find(event => event.seriesSlug === resolved.series && event.edition === resolved.edition);
    if (!tournament) throw new RuleError('赛事不存在。', 404);
    return await action(resolveTournamentScope(tournament.id, isDemo()), resolved);
  } catch (error) { return errorResponse(error); }
}
