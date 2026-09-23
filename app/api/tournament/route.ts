import { readTournament, errorResponse, isDemo } from "@/lib/store";
import { publicTournament } from "@/lib/tournament";
export async function GET() {
  try {
    return Response.json(
      { tournament: publicTournament(await readTournament()), demo: isDemo() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
