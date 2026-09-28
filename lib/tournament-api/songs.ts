import type { TournamentScope } from "@/lib/tournament-scope";
import { readTournament, errorResponse } from "@/lib/store";
import { publicSongCatalog } from "@/lib/song-catalog.server";

export async function GET(scope: TournamentScope) {
  try {
    return Response.json(await publicSongCatalog(await readTournament(scope), scope), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
