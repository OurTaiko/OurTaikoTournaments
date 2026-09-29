import type { TournamentScope } from "@/lib/tournament-scope";
import { isCenturyLinkScope } from "@/lib/tournament-scope";
import * as centuryLink from "./centurylink";
import { readTournament, errorResponse } from "@/lib/store";
import { publicSongCatalog } from "@/lib/song-catalog.server";

export async function GET(scope: TournamentScope) {
  if (isCenturyLinkScope(scope)) return centuryLink.songs(scope);
  try {
    return Response.json(await publicSongCatalog(await readTournament(scope), scope), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
