import * as handlers from "@/lib/tournament-api/matches";
import { withTournamentScope, type TournamentParams } from "@/lib/tournament-api/route-scope";

export function GET(req: Request, { params }: { params: Promise<TournamentParams & { id: string }> }) {
  return withTournamentScope(params, (scope, params) => handlers.GET(req, scope, params.id));
}
export function POST(req: Request, { params }: { params: Promise<TournamentParams & { id: string }> }) {
  return withTournamentScope(params, (scope, params) => handlers.POST(req, scope, params.id));
}
