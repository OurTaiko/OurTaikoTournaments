import { runtime } from "@/lib/runtime";
export { runtime } from "@/lib/runtime";
import { makeTournament, type Tournament } from "./tournament";
import { RuleError } from "./rules";
export function db() {
  return runtime.DB;
}
export function isDemo() {
  return runtime.DEMO_MODE === "true";
}
export async function readTournament() {
  const id = isDemo() ? "demo" : "edition-1";
  let row = await db()
    .prepare("SELECT body FROM tournaments WHERE id = ?")
    .bind(id)
    .first<{ body: string }>();
  if (!row) {
    const initial = makeTournament(isDemo());
    await db()
      .prepare(
        "INSERT OR IGNORE INTO tournaments (id, revision, body) VALUES (?, ?, ?)",
      )
      .bind(id, 0, JSON.stringify(initial))
      .run();
    row = await db()
      .prepare("SELECT body FROM tournaments WHERE id = ?")
      .bind(id)
      .first<{ body: string }>();
  }
  return JSON.parse(row!.body) as Tournament;
}
export async function writeTournament(next: Tournament, previous: number) {
  const result = await db()
    .prepare(
      "UPDATE tournaments SET body = ?, revision = ? WHERE id = ? AND revision = ?",
    )
    .bind(
      JSON.stringify(next),
      next.revision,
      isDemo() ? "demo" : "edition-1",
      previous,
    )
    .run();
  if (!result.meta.changes)
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
