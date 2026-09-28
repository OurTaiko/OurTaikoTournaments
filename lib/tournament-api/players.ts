import type { TournamentScope } from "@/lib/tournament-scope";
import { requireTournamentAdmin } from '@/lib/tournament-access';
import { applyPlayerAction } from '@/lib/player-management';
import { RuleError } from '@/lib/rules';
import { readTournament, writeTournament, originCheck, errorResponse } from '@/lib/store';
import { publicTournament } from '@/lib/tournament';

export async function POST(req: Request, scope: TournamentScope) {
  try {
    originCheck(req);
    await requireTournamentAdmin(req, scope);
    const text = await req.text();
    if (text.length > 4096) throw new RuleError('请求过大。', 413);
    let input;
    try { input = JSON.parse(text); } catch { throw new RuleError('请求格式无效。'); }
    if (!input || !Number.isSafeInteger(input.revision) || input.revision < 0 || input.revision >= Number.MAX_SAFE_INTEGER)
      throw new RuleError('赛事版本无效，请刷新后重试。');
    const t = await readTournament(scope);
    if (t.revision !== input.revision) throw new RuleError('赛事或选手资料已更新，请刷新后重试。', 409);
    const next = applyPlayerAction(t, input.action);
    await writeTournament(next, t.revision, scope);
    return Response.json({ tournament: publicTournament(next) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return errorResponse(e); }
}
