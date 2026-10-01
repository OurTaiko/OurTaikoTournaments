"use client";
import Image from "next/image";
import { useRef } from "react";
import { Dialog } from "radix-ui";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { GalleryPhoto } from "@/lib/gallery";

/** Full-screen viewer shared by the gallery pages: arrow keys, swipe and wrap-around. */
export default function PhotoLightbox({ photos, index, onIndexChange, title }: {
  photos: GalleryPhoto[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
  title: string;
}) {
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const photo = index === null ? null : photos[index];
  const count = photos.length;
  const go = (step: number) => index !== null && onIndexChange((index + step + count) % count);
  const neighbours = index === null || count < 2 ? [] : [photos[(index + 1) % count], photos[(index - 1 + count) % count]];
  return <Dialog.Root open={!!photo} onOpenChange={open => !open && onIndexChange(null)}>
    <Dialog.Portal>
      <Dialog.Overlay className="lightbox-overlay" />
      <Dialog.Content className="lightbox" aria-describedby={undefined} onKeyDown={event => {
        if (event.key === "ArrowRight") { event.preventDefault(); go(1); }
        if (event.key === "ArrowLeft") { event.preventDefault(); go(-1); }
      }}>
        <Dialog.Title className="sr-only">{title}</Dialog.Title>
        {photo && <>
          <div className="lightbox-bar">
            <span className="lightbox-count">{String(index! + 1).padStart(2, "0")}<span> / {String(count).padStart(2, "0")}</span></span>
            <Dialog.Close className="lightbox-button" aria-label="关闭"><X size={20} /></Dialog.Close>
          </div>
          <div className="lightbox-stage"
            onPointerDown={event => { swipe.current = { x: event.clientX, y: event.clientY }; }}
            onPointerUp={event => {
              const start = swipe.current;
              swipe.current = null;
              if (!start) return;
              const dx = event.clientX - start.x;
              if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(event.clientY - start.y)) go(dx < 0 ? 1 : -1);
            }}>
            <Image key={photo.id} className="lightbox-image" src={photo.image} alt={photo.alt} fill sizes="100vw" placeholder="blur" draggable={false} />
            <div className="lightbox-preload" aria-hidden="true">
              {neighbours.map(p => <Image key={p.id} src={p.image} alt="" fill sizes="100vw" loading="eager" />)}
            </div>
          </div>
          {count > 1 && <>
            <button className="lightbox-button lightbox-prev" onClick={() => go(-1)} aria-label="上一张"><ChevronLeft size={24} /></button>
            <button className="lightbox-button lightbox-next" onClick={() => go(1)} aria-label="下一张"><ChevronRight size={24} /></button>
          </>}
          <div className="lightbox-caption">
            {photo.caption && <b>{photo.caption}</b>}
            <span>{photo.alt}</span>
          </div>
        </>}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
