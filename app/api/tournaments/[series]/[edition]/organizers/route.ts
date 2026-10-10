import archive from '@/data/archive/hachicats-20260927.json';
import { HACHICATS_TOURNAMENT_ID } from '@/lib/tournaments';
import { tournamentStorageId } from '@/lib/tournament-scope';
import { db } from '@/lib/store';
import { RuleError } from '@/lib/rules';
import { organizerNicknames } from '@/lib/sso-profiles.server';
import { withTournamentScope, type TournamentParams } from '@/lib/tournament-api/route-scope';

export function GET(_req: Request, { params }: { params: Promise<TournamentParams> }) {
  return withTournamentScope(params, async scope => {
    if (scope.tournamentId === HACHICATS_TOURNAMENT_ID)
      return Response.json({ organizerNames: archive.organizerNames }, { headers: { 'Cache-Control': 'no-store' } });
    const people = await db().getTournamentPeople(tournamentStorageId(scope));
    if (!people) throw new RuleError('赛事不存在。', 404);
    return Response.json({ organizerNames: await organizerNicknames(people.organizers) },
      { headers: { 'Cache-Control': 'no-store' } });
  });
}
