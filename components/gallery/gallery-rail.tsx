"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import PhotoLightbox from "@/components/gallery/photo-lightbox";
import { findGallery, galleryPhotos } from "@/lib/gallery";

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
  return <div className="gallery-rail-wrap">
    <div className="gallery-rail" ref={rail} role="region" aria-label={`${gallery.name}照片`}>
      {photos.map((photo, i) => <button key={photo.id} type="button" className="gallery-rail-item"
        style={{ aspectRatio: `${photo.image.width} / ${photo.image.height}` }}
        onClick={() => setIndex(i)} aria-label={`查看大图：${photo.caption ?? photo.alt}`}>
        <Image src={photo.image} alt={photo.alt} placeholder="blur" fill sizes="(max-width: 760px) 70vw, 480px" />
      </button>)}
    </div>
    <div className="gallery-rail-controls">
      <button type="button" className="gallery-round-button" onClick={() => page(-1)} disabled={edges.start} aria-label="向前滚动"><ChevronLeft size={20} /></button>
      <button type="button" className="gallery-round-button" onClick={() => page(1)} disabled={edges.end} aria-label="向后滚动"><ChevronRight size={20} /></button>
    </div>
    <PhotoLightbox photos={photos} index={index} onIndexChange={setIndex} title={`${gallery.name} · 赛事相册`} />
  </div>;
}
