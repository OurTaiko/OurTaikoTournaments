import type { TournamentScope } from "@/lib/tournament-scope";
import { requireTournamentAdmin } from "@/lib/tournament-access";
import { errorResponse, originCheck } from "@/lib/store";
import { RuleError } from "@/lib/rules";
import { applyClAction, applyClPlayerAction, type ClAction } from "@/lib/centurylink-rules";
import { publicCenturyLink } from "@/lib/centurylink";
import {
  adminMatchSongs, publicCenturyLinkCatalog, readCenturyLink, writeCenturyLink,
} from "@/lib/centurylink.server";

const noStore = { "Cache-Control": "no-store" };

export async function state(scope: TournamentScope) {
  try {
    return Response.json({ tournament: publicCenturyLink(await readCenturyLink(scope)), demo: scope.demo }, { headers: noStore });
  } catch (e) { return errorResponse(e); }
}

export async function songs(scope: TournamentScope) {
  try {
    return Response.json(await publicCenturyLinkCatalog(await readCenturyLink(scope), scope), { headers: noStore });
  } catch (e) { return errorResponse(e); }
}

export async function match(req: Request, scope: TournamentScope, id: string) {
  try {
    await requireTournamentAdmin(req, scope);
    const t = await readCenturyLink(scope);
    const found = t.matches.find(m => m.id === id);
    if (!found) throw new RuleError("比赛不存在。", 404);
    return Response.json({ match: found, revision: t.revision, ...await adminMatchSongs(found, scope) }, { headers: noStore });
  } catch (e) { return errorResponse(e); }
}

export async function saveMatch(req: Request, scope: TournamentScope, id: string) {
  try {
    originCheck(req);
    await requireTournamentAdmin(req, scope);
    if (Number(req.headers.get("content-length") || 0) > 20000) throw new RuleError("请求过大。");
    const body = (await req.json()) as ClAction & { revision: number; matchRevision: number };
    if (!body || !Number.isSafeInteger(body.revision) || body.revision < 0 || body.revision >= Number.MAX_SAFE_INTEGER ||
      !Number.isSafeInteger(body.matchRevision) || body.matchRevision < 0 || body.matchRevision > body.revision)
      throw new RuleError("比赛版本无效，请重新打开比赛后提交。");
    // Replay unrelated races against fresh state; same-match changes still reject stale editors.
    for (let attempt = 0; attempt < 4; attempt++) {
      const t = await readCenturyLink(scope);
      const current = t.matches.find(m => m.id === id);
      if (!current) throw new RuleError("比赛不存在。", 404);
      if ((current.revision ?? 0) !== body.matchRevision)
        throw new RuleError("本场比赛或参赛选手已更新，请重新打开比赛后提交。", 409);
      const next = applyClAction(t, id, body);
      try { await writeCenturyLink(next, t.revision, scope); }
      catch (error) { if (error instanceof RuleError && error.status === 409) continue; throw error; }
      return Response.json({ match: next.matches.find(m => m.id === id), revision: next.revision }, { headers: noStore });
    }
    throw new RuleError("其他比赛正在更新，请稍后再次提交。本次输入已保留。", 409);
  } catch (e) { return errorResponse(e); }
}

export async function players(req: Request, scope: TournamentScope) {
  try {
    originCheck(req);
    await requireTournamentAdmin(req, scope);
    const text = await req.text();
    if (text.length > 4096) throw new RuleError("请求过大。", 413);
    let input;
    try { input = JSON.parse(text); } catch { throw new RuleError("请求格式无效。"); }
    if (!input || !Number.isSafeInteger(input.revision) || input.revision < 0 || input.revision >= Number.MAX_SAFE_INTEGER)
      throw new RuleError("赛事版本无效，请刷新后重试。");
    const t = await readCenturyLink(scope);
    if (t.revision !== input.revision) throw new RuleError("赛事或选手资料已更新，请刷新后重试。", 409);
    const next = applyClPlayerAction(t, input.action);
    await writeCenturyLink(next, t.revision, scope);
    return Response.json({ tournament: publicCenturyLink(next) }, { headers: noStore });
  } catch (e) { return errorResponse(e); }
}
