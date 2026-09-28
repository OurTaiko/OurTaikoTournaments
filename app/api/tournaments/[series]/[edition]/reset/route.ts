import * as handlers from "@/lib/tournament-api/reset";
import { withTournamentScope, type TournamentParams } from "@/lib/tournament-api/route-scope";

export function POST(req: Request, { params }: { params: Promise<TournamentParams> }) {
  return withTournamentScope(params, (scope) => handlers.POST(req, scope));
}
