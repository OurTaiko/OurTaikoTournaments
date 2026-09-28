import * as handlers from "@/lib/tournament-api/songs";
import { withTournamentScope, type TournamentParams } from "@/lib/tournament-api/route-scope";

export function GET(_req: Request, { params }: { params: Promise<TournamentParams> }) {
  return withTournamentScope(params, (scope) => handlers.GET(scope));
}
