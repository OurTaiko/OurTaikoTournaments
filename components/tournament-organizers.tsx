'use client';

import { useEffect, useState } from 'react';
import { UsersRound } from 'lucide-react';
import { eventDetail } from '@/components/styles';
import { tournamentApiPath } from '@/lib/tournaments';
import { cn } from '@/lib/utils';

type Result = { tournamentId: string; attempt: number; names: string[] | null };

export default function TournamentOrganizers({ tournamentId }: { tournamentId: string }) {
  const [result, setResult] = useState<Result | null>(null);
  const [attempt, setAttempt] = useState(0);
  const current = result?.tournamentId === tournamentId && result.attempt === attempt ? result : null;
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`${tournamentApiPath(tournamentId)}/organizers`, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('Nickname lookup failed');
        const body = await response.json();
        if (!Array.isArray(body.organizerNames) || !body.organizerNames.every((name: unknown) => typeof name === 'string' && name.trim()))
          throw new Error('Invalid nicknames');
        if (!controller.signal.aborted) setResult({ tournamentId, attempt, names: body.organizerNames });
      } catch {
        if (!controller.signal.aborted) setResult({ tournamentId, attempt, names: null });
      }
    })();
    return () => controller.abort();
  }, [tournamentId, attempt]);
  return (
    <p className={cn(eventDetail, 'mt-3 items-start text-[14px] text-muted-foreground mobile:text-[12px]')}>
      <UsersRound aria-hidden="true" className="mt-1 size-4 shrink-0" />
      <span className="min-w-0 break-words" aria-live="polite">
        主办方：{!current ? '正在加载昵称…' : current.names ? current.names.join('、') || '待公布' : <>昵称暂时无法加载 <button type="button" className="underline underline-offset-4 hover:text-primary" onClick={() => setAttempt(value => value + 1)}>重试</button></>}
      </span>
    </p>
  );
}
