"use client";

import { useEffect, useState } from "react";
import type { CenturyLink } from "@/lib/centurylink";
import { obsMatches, type ObsMatch } from "@/lib/obs-matches";
import type { SongCatalog } from "@/lib/songs";
import type { Tournament } from "@/lib/tournament";

export function useObsFeed(apiPath: string | null) {
  const [matches, setMatches] = useState<ObsMatch[]>([]);
  const [catalog, setCatalog] = useState<SongCatalog>({});
  const [loaded, setLoaded] = useState(false);
  const [disconnected, setDisconnected] = useState(false);
  const [songsUnavailable, setSongsUnavailable] = useState(false);

  useEffect(() => {
    if (!apiPath) return;
    const lifecycle = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let revision = -1;
    let songRefreshAt = 0;
    let songs: SongCatalog = {};

    async function read(path: string) {
      const response = await fetch(path, {
        cache: "no-store", credentials: "omit",
        signal: AbortSignal.any([lifecycle.signal, AbortSignal.timeout(10_000)]),
      });
      if (!response.ok) throw new Error("OBS feed unavailable");
      return response.json();
    }

    async function poll() {
      try {
        const data = await read(apiPath!) as { tournament: Tournament | CenturyLink };
        if (lifecycle.signal.aborted) return;
        const next = obsMatches(data.tournament);
        if (data.tournament.revision >= revision) {
          revision = data.tournament.revision;
          setMatches(next);
        }
        setLoaded(true);
        setDisconnected(false);
        // Refresh immediately when a newly published chart is not in our public catalog.
        if (Date.now() >= songRefreshAt || next.some(m => m.scores.some(s => !songs[s.songId]))) {
          try {
            const data = await read(apiPath + "/songs") as { catalog: SongCatalog; stale?: boolean; incomplete?: boolean };
            if (lifecycle.signal.aborted) return;
            songs = data.catalog;
            songRefreshAt = Date.now() + 30_000;
            setCatalog(songs);
            setSongsUnavailable(!!data.stale || !!data.incomplete);
          } catch {
            if (!lifecycle.signal.aborted) setSongsUnavailable(true);
          }
        }
      } catch {
        if (!lifecycle.signal.aborted) setDisconnected(true);
      } finally {
        // Serialize requests, retry failures and cancel everything on navigation.
        if (!lifecycle.signal.aborted) timer = setTimeout(() => void poll(), 3000);
      }
    }
    void poll();
    return () => { lifecycle.abort(); clearTimeout(timer); };
  }, [apiPath]);

  return { matches, catalog, loaded, disconnected, songsUnavailable };
}
