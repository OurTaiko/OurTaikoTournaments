import { designatedSong, songMetadata } from "@/lib/song-catalog.server";
import { requireAdmin } from "@/lib/auth";
import { readSongLibrary } from '@/lib/song-library.server';
import { resolveSong } from '@/lib/songs';
import {
  readTournament,
  writeTournament,
  errorResponse,
  originCheck,
} from "@/lib/store";
import { applyAction, RuleError, type Action } from "@/lib/rules";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin(req);
    const t = await readTournament();
    const { id } = await params;
    const match = t.matches.find((m) => m.id === id);
    if (!match) throw new RuleError("比赛不存在。", 404);
    const [library, { metadata }] = await Promise.all([readSongLibrary(), songMetadata()]);
    return Response.json(
      {
        match,
        revision: t.revision,
        pool: library.pools[match.group].map(ref => resolveSong(ref.id, ref, metadata)),
        designated:
          match.round >= 3
            ? designatedSong(match, metadata, library)
            : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    originCheck(req);
    await requireAdmin(req);
    if (Number(req.headers.get("content-length") || 0) > 20000)
      throw new RuleError("请求过大。");
    const body = (await req.json()) as Action & { revision: number; matchRevision?: number };
    if (!body || !Number.isSafeInteger(body.revision) || body.revision < 0 || body.revision >= Number.MAX_SAFE_INTEGER ||
      (body.matchRevision !== undefined && (!Number.isSafeInteger(body.matchRevision) || body.matchRevision < 0 || body.matchRevision > body.revision)))
      throw new RuleError("比赛版本无效，请重新打开比赛后提交。");
    const { id } = await params;
    const library = await readSongLibrary();
    // Keep the whole-document CAS, but replay unrelated races against fresh state.
    // Same-match edits, lineup changes and resets must still reject stale editors.
    for (let attempt = 0; attempt < 4; attempt++) {
      const t = await readTournament();
      const match = t.matches.find(match => match.id === id);
      if (!match) throw new RuleError('比赛不存在。', 404);
      if (body.matchRevision === undefined ? t.revision !== body.revision : (match.revision ?? 0) !== body.matchRevision)
        throw new RuleError(body.matchRevision === undefined
          ? "赛况刚被更新，请重新打开比赛后提交。"
          : "本场比赛或参赛选手已更新，请重新打开比赛后提交。", 409);
      const next = applyAction(t, id, body, library.pools[match.group]);
      try {
        await writeTournament(next, t.revision);
      } catch (error) {
        if (error instanceof RuleError && error.status === 409 && body.matchRevision !== undefined) continue;
        throw error;
      }
      return Response.json({
        match: next.matches.find(match => match.id === id),
        revision: next.revision,
      }, { headers: { "Cache-Control": "no-store" } });
    }
    throw new RuleError("其他比赛正在更新，请稍后再次提交。本次输入已保留。", 409);
  } catch (e) {
    return errorResponse(e);
  }
}
