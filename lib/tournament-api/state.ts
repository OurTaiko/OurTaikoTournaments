import type { TournamentScope } from "@/lib/tournament-scope";
import { readTournament, errorResponse } from "@/lib/store";
import { publicTournament } from "@/lib/tournament";
export async function GET(scope: TournamentScope) {
  try {
    return Response.json(
      { tournament: publicTournament(await readTournament(scope)), demo: scope.demo },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
