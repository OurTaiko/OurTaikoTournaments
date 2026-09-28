import type { TournamentScope } from "@/lib/tournament-scope";
import { requireTournamentAdmin } from '@/lib/tournament-access';
import { db, errorResponse, originCheck } from '@/lib/store';
import { resetTournament } from '@/lib/reset-tournament';
import { RuleError } from '@/lib/rules';
import { publicTournament } from '@/lib/tournament';

export async function POST(req: Request, scope: TournamentScope) {
  try {
    originCheck(req);
    const user = await requireTournamentAdmin(req, scope);
    // Read a bounded body, including requests without Content-Length.
    const reader = req.body?.getReader();
    if (!reader) throw new RuleError('重置请求不能为空。');
    let size = 0;
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2048) { await reader.cancel(); throw new RuleError('请求过大。', 413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    let body: unknown;
    try { body = JSON.parse(new TextDecoder().decode(bytes)); }
    catch { throw new RuleError('重置请求格式错误。'); }
    const result = await resetTournament(db(), scope.demo, body, user.username, scope);
    return Response.json({ tournament: publicTournament(result.tournament), backupId: result.backupId }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}
