"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import PhotoLightbox from "@/components/gallery/photo-lightbox";
import { findGallery, galleryPhotos } from "@/lib/gallery";

const roundButton = "grid place-items-center w-10 h-10 rounded-[50%] bg-[rgb(255_255_255/12%)] text-g-text enabled:hover:bg-[rgb(255_255_255/22%)] disabled:opacity-30";

/** Horizontal, snap-scrolling film strip of every photo in one tournament. */
export default function GalleryRail({ tournamentId }: { tournamentId: string }) {
  const gallery = findGallery(tournamentId);
  const photos = galleryPhotos(gallery);
  const rail = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const [index, setIndex] = useState<number | null>(null);
  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const update = () => setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { el.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, []);
  const page = (direction: number) => rail.current?.scrollBy({ left: direction * rail.current.clientWidth * 0.8, behavior: "smooth" });
  return <div className="relative">
    <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-px-[max(40px,calc((100vw-1120px)/2))] px-[max(40px,calc((100vw-1120px)/2))] pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden overscroll-x-contain mobile:gap-2 mobile:scroll-px-4 mobile:px-4" ref={rail} role="region" aria-label={`${gallery.name}照片`}>
      {photos.map((photo, i) => <button key={photo.id} type="button" className="group relative flex-none h-[300px] p-0 rounded-[14px] overflow-hidden bg-g-surface snap-start cursor-zoom-in mobile:h-[200px] mobile:rounded-[10px]"
        style={{ aspectRatio: `${photo.image.width} / ${photo.image.height}` }}
        onClick={() => setIndex(i)} aria-label={`查看大图：${photo.caption ?? photo.alt}`}>
        <Image src={photo.image} alt={photo.alt} placeholder="blur" fill className="object-cover [transition:transform_.7s_var(--ease-apple)] group-hover:[transform:scale(1.04)]" sizes="(max-width: 760px) 70vw, 480px" />
      </button>)}
    </div>
    <div className="max-w-[1200px] mt-[18px] mx-auto px-10 flex justify-end gap-2.5 mobile:hidden mobile:px-4">
      <button type="button" className={roundButton} onClick={() => page(-1)} disabled={edges.start} aria-label="向前滚动"><ChevronLeft size={20} /></button>
      <button type="button" className={roundButton} onClick={() => page(1)} disabled={edges.end} aria-label="向后滚动"><ChevronRight size={20} /></button>
    </div>
    <PhotoLightbox photos={photos} index={index} onIndexChange={setIndex} title={`${gallery.name} · 赛事相册`} />
  </div>;
}
