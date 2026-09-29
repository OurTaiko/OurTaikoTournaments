"use client";
import { tournamentApiPath } from "@/lib/tournaments";
import { useCallback, useEffect, useState } from "react";
import { emptySongPools, type SongCatalog, type SongPools } from "@/lib/songs";

export function useSongCatalog<P = SongPools>(tournamentId: string, emptyPools: P = emptySongPools as P) {
  const [songs, setSongs] = useState<{ catalog: SongCatalog; pools: P }>({ catalog: {}, pools: emptyPools });
  const [notice, setNotice] = useState("正在加载曲目信息…");
  const refresh = useCallback((signal?: AbortSignal) =>
    fetch(tournamentApiPath(tournamentId) + "/songs", { cache: "no-store", signal }).then(async (response) => {
      if (!response.ok) throw new Error("Song catalog unavailable");
      const data = await response.json() as {
        catalog: SongCatalog;
        pools: P;
        stale: boolean;
        incomplete: boolean;
        updatedAt: string | null;
      };
      if (signal?.aborted) return;
      // Always replace visibility/membership from the server, even if metadata is offline.
      setSongs({ catalog: data.catalog, pools: data.pools });
      setNotice(data.stale ? "曲名接口暂不可用，部分曲目可能显示编号，正在自动重试。" : data.incomplete ? "部分曲目信息暂不可用，请稍后刷新。" : "");
    }).catch(() => {
      if (!signal?.aborted) setNotice("曲目信息暂时无法更新，正在自动重试。");
    }), [tournamentId]);
  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    const interval = setInterval(() => void refresh(controller.signal), 30_000);
    return () => { controller.abort(); clearInterval(interval); };
  }, [refresh]);
  return { ...songs, notice, refresh };
}
