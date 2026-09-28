import { viewer } from '@/lib/auth';
import { canManageTournament } from '@/lib/tournament-access';
import { withTournamentScope, type TournamentParams } from '@/lib/tournament-api/route-scope';

export function GET(req: Request, { params }: { params: Promise<TournamentParams> }) {
  return withTournamentScope(params, async scope => Response.json(
    { canManage: canManageTournament(scope, await viewer(req)) },
    { headers: { 'Cache-Control': 'no-store' } },
  ));
}
