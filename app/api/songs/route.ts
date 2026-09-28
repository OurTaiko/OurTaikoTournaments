import * as handlers from "@/lib/tournament-api/songs";
import { hachicatsScope } from "@/lib/tournament-scope";
import { isDemo } from "@/lib/store";

// Compatibility alias: this endpoint always belongs to HachiCats.
export function GET() { return handlers.GET(hachicatsScope(isDemo())); }
