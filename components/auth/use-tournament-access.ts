"use client";

import { useEffect, useState } from 'react';
import { useSSO } from './sso-context';
import { tournamentApiPath } from '@/lib/tournaments';
import type { Viewer } from '@/lib/auth';

/** UI permission only; every write is independently authorized by the server. */
export function useTournamentAccess(tournamentId: string) {
  const { user, loading, error, refresh } = useSSO();
  const [access, setAccess] = useState<{
    user: Viewer;
    tournamentId: string;
    canManage: boolean;
    error: string;
  } | null>(null);
  useEffect(() => {
    if (!user || loading || error) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(tournamentApiPath(tournamentId) + '/access', {
          cache: 'no-store', signal: controller.signal,
        });
        const result = await response.json() as { canManage?: boolean; error?: string };
        if (!response.ok) throw new Error(result.error || '无法验证赛事权限，请重试。');
        if (!controller.signal.aborted) setAccess({ user, tournamentId, canManage: result.canManage === true, error: '' });
      } catch (cause) {
        if (!controller.signal.aborted) setAccess({ user, tournamentId, canManage: false,
          error: cause instanceof Error ? cause.message : '无法验证赛事权限，请重试。' });
      }
    })();
    return () => controller.abort();
  }, [user, tournamentId, loading, error]);
  // Revalidating the same identity must not unmount an editor and discard unsaved scores.
  // A different identity, role, event, or failed verification immediately loses access.
  const current = user && access?.user.id === user.id && access.user.admin === user.admin &&
    access.user.demo === user.demo && access.tournamentId === tournamentId ? access : null;
  return {
    canManage: !loading && !error && !!user && !!current?.canManage,
    loading: loading || (!!user && !error && !current),
    error: error || current?.error || '',
    refresh,
  };
}
