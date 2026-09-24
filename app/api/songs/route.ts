import { readTournament, errorResponse } from "@/lib/store";
import { publicSongCatalog } from "@/lib/song-catalog.server";

export async function GET() {
  try {
    return Response.json(await publicSongCatalog(await readTournament()), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
