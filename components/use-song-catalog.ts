"use client";
import { useCallback, useEffect, useState } from "react";
import { initialSongCatalog, type SongCatalog } from "@/lib/songs";

export function useSongCatalog() {
  const [catalog, setCatalog] = useState<SongCatalog>(initialSongCatalog);
  const [notice, setNotice] = useState("正在加载曲目信息…");
  const refresh = useCallback((signal?: AbortSignal) =>
    fetch("/api/songs", { cache: "no-store", signal }).then(async (response) => {
      if (!response.ok) throw new Error("Song catalog unavailable");
      const data = await response.json() as {
        catalog: SongCatalog;
        stale: boolean;
        incomplete: boolean;
        updatedAt: string | null;
      };
      if (signal?.aborted) return;
      setCatalog((previous) => data.stale && !data.updatedAt ? previous : data.catalog);
      setNotice(data.stale ? "歌曲接口暂不可用，已保留最近获取的信息。" : data.incomplete ? "部分曲目信息暂不可用，请稍后刷新。" : "");
    }).catch(() => {
      if (!signal?.aborted) setNotice("曲目信息暂时无法更新，正在自动重试。");
    }), []);
  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    const interval = setInterval(() => void refresh(controller.signal), 30_000);
    return () => { controller.abort(); clearInterval(interval); };
  }, [refresh]);
  return { catalog, notice, refresh };
}
