import * as handlers from "@/lib/tournament-api/matches";
import { hachicatsScope } from "@/lib/tournament-scope";
import { isDemo } from "@/lib/store";

// Compatibility alias: this endpoint always belongs to HachiCats.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handlers.GET(req, hachicatsScope(isDemo()), (await params).id);
}
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handlers.POST(req, hachicatsScope(isDemo()), (await params).id);
}
