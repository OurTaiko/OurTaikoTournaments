import * as handlers from "@/lib/tournament-api/players";
import { hachicatsScope } from "@/lib/tournament-scope";
import { isDemo } from "@/lib/store";

// Compatibility alias: this endpoint always belongs to HachiCats.
export function POST(req: Request) { return handlers.POST(req, hachicatsScope(isDemo())); }
