"use client";
import Image from "next/image";
import { useRef } from "react";
import { Dialog } from "radix-ui";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { GalleryPhoto } from "@/lib/gallery";
import { cn } from "@/lib/utils";

const button = "grid place-items-center w-11 h-11 rounded-[50%] bg-[rgb(255_255_255/10%)] text-g-text hover:bg-[rgb(255_255_255/20%)]";
const arrow = cn(button, "absolute top-1/2 [translate:0_-50%] mobile:top-auto mobile:bottom-[18px] mobile:[translate:none]");

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
      <Dialog.Overlay className="fixed inset-0 z-60 bg-[rgb(0_0_0/94%)] backdrop-blur-[10px] data-[state=open]:animate-gallery-fade" />
      <Dialog.Content className="fixed inset-0 z-[61] grid grid-rows-[auto_1fr_auto] text-g-text outline-none data-[state=open]:animate-gallery-fade" aria-describedby={undefined} onKeyDown={event => {
        if (event.key === "ArrowRight") { event.preventDefault(); go(1); }
        if (event.key === "ArrowLeft") { event.preventDefault(); go(-1); }
      }}>
        <Dialog.Title className="sr-only">{title}</Dialog.Title>
        {photo && <>
          <div className="flex justify-between items-center pt-3.5 pr-[18px] pb-2 pl-6">
            <span className="text-[15px] font-semibold tabular-nums">{String(index! + 1).padStart(2, "0")}<span className="text-[#86868b] font-[450]"> / {String(count).padStart(2, "0")}</span></span>
            <Dialog.Close className={button} aria-label="关闭"><X size={20} /></Dialog.Close>
          </div>
          <div className="relative mx-[76px] touch-pan-y select-none mobile:mx-0"
            onPointerDown={event => { swipe.current = { x: event.clientX, y: event.clientY }; }}
            onPointerUp={event => {
              const start = swipe.current;
              swipe.current = null;
              if (!start) return;
              const dx = event.clientX - start.x;
              if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(event.clientY - start.y)) go(dx < 0 ? 1 : -1);
            }}>
            <Image key={photo.id} className="object-contain animate-gallery-photo" src={photo.image} alt={photo.alt} fill sizes="100vw" placeholder="blur" draggable={false} />
            <div className="absolute inset-0 invisible pointer-events-none" aria-hidden="true">
              {neighbours.map(p => <Image key={p.id} src={p.image} alt="" fill sizes="100vw" loading="eager" />)}
            </div>
          </div>
          {count > 1 && <>
            <button className={cn(arrow, "left-[18px]")} onClick={() => go(-1)} aria-label="上一张"><ChevronLeft size={24} /></button>
            <button className={cn(arrow, "right-[18px]")} onClick={() => go(1)} aria-label="下一张"><ChevronRight size={24} /></button>
          </>}
          <div className="grid justify-items-center gap-1 pt-3.5 px-6 pb-[22px] text-center text-[14px] mobile:px-[72px] mobile:pb-6">
            {photo.caption && <b>{photo.caption}</b>}
            <span className="text-g-muted text-[13px]">{photo.alt}</span>
          </div>
        </>}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
