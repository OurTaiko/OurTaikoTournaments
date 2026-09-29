import { hachicatsScope, tournamentStorageId, type TournamentScope } from "./tournament-scope";
import { makeTournament, rosters } from "./tournament-seed";
import { runtime } from "@/lib/runtime";
export { runtime } from "@/lib/runtime";
import {
  hydrateTournament,
  tournamentState,
  type StoredTournament,
  type Tournament,
} from "./tournament";
import { RuleError } from "./rules";
export function db() {
  return runtime.DB;
}
export function isDemo() {
  return runtime.DEMO_MODE === "true";
}
export async function readTournament(scope: TournamentScope = hachicatsScope(isDemo())) {
  const id = tournamentStorageId(scope);
  let row = await db().getTournament(id);
  if (!row) {
    if (runtime.MONGODB_URI && !scope.demo)
      throw new Error("Production tournament must be imported before serving requests");
    const initial = makeTournament(scope.demo);
    await db().createTournament({ id, revision: 0, body: JSON.stringify(tournamentState(initial)) });
    row = await db().getTournament(id);
  }
  const stored = JSON.parse(row!.body) as StoredTournament;
  if (!stored.rosters) {
    if (runtime.MONGODB_URI && !scope.demo)
      throw new Error("Production players must be migrated before serving requests");
    stored.rosters = structuredClone(rosters);
  }
  return hydrateTournament(stored);
}
export async function writeTournament(next: Tournament, previous: number, scope: TournamentScope = hachicatsScope(isDemo())) {
  const updated = await db().updateTournament({
    id: tournamentStorageId(scope),
    body: JSON.stringify(tournamentState(next)),
    revision: next.revision,
  }, previous);
  if (!updated)
    throw new RuleError("赛况刚被另一位工作人员更新，请刷新比赛后重试。", 409);
}
export function errorResponse(e: unknown) {
  if (e instanceof RuleError)
    return Response.json({ error: e.message }, { status: e.status, headers: { "Cache-Control": "no-store" } });
  console.error(
    "Tournament request failed",
    e instanceof Error ? e.name : "Unknown",
    e && typeof e === "object" && "code" in e && typeof e.code === "number" ? e.code : "",
  );
  return Response.json(
    { error: "暂时无法连接赛事服务，请稍后重试。" },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
export function originCheck(request: Request) {
  if (request.headers.get("origin") !== runtime.APP_ORIGIN)
    throw new RuleError("请求来源不匹配，请从赛事页面操作。", 403);
}
