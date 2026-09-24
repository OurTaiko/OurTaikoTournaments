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
    const body = (await req.json()) as Action & { revision: number };
    const t = await readTournament();
    if (t.revision !== body.revision)
      throw new RuleError("赛况刚被更新，请重新打开比赛后提交。", 409);
    const { id } = await params;
    const match = t.matches.find(match => match.id === id);
    if (!match) throw new RuleError('比赛不存在。', 404);
    const library = await readSongLibrary();
    const next = applyAction(t, id, body, library.pools[match.group]);
    await writeTournament(next, t.revision);
    return Response.json({
      match: next.matches.find((m) => m.id === id),
      revision: next.revision,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
