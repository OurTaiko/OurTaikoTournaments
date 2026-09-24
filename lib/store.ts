import { runtime } from "@/lib/runtime";
export { runtime } from "@/lib/runtime";
import {
  makeTournament,
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
export async function readTournament() {
  const id = isDemo() ? "demo" : "edition-1";
  let row = await db().getTournament(id);
  if (!row) {
    if (runtime.MONGODB_URI && !isDemo())
      throw new Error("Production tournament must be imported before serving requests");
    const initial = makeTournament(isDemo());
    await db().createTournament({ id, revision: 0, body: JSON.stringify(tournamentState(initial)) });
    row = await db().getTournament(id);
  }
  return hydrateTournament(JSON.parse(row!.body) as StoredTournament);
}
export async function writeTournament(next: Tournament, previous: number) {
  const updated = await db().updateTournament({
    id: isDemo() ? "demo" : "edition-1",
    body: JSON.stringify(tournamentState(next)),
    revision: next.revision,
  }, previous);
  if (!updated)
    throw new RuleError("赛况刚被另一位工作人员更新，请刷新比赛后重试。", 409);
}
export function errorResponse(e: unknown) {
  if (e instanceof RuleError)
    return Response.json({ error: e.message }, { status: e.status });
  console.error(
    "HachiCats request failed",
    e instanceof Error ? e.name : "Unknown",
  );
  return Response.json(
    { error: "暂时无法连接赛事服务，请稍后重试。" },
    { status: 503 },
  );
}
export function originCheck(request: Request) {
  if (request.headers.get("origin") !== runtime.APP_ORIGIN)
    throw new RuleError("请求来源不匹配，请从赛事页面操作。", 403);
}
