"use client";
import Image from "next/image";
import { useState } from "react";
import { Expand } from "lucide-react";
import PhotoLightbox from "@/components/gallery/photo-lightbox";
import { galleryKicker, galleryWrap } from "@/components/styles";
import { findGallery, galleryPhotos, type GalleryPhoto } from "@/lib/gallery";
import { cn } from "@/lib/utils";

const tileClass = "group relative block w-full p-0 rounded-[14px] overflow-hidden bg-g-surface cursor-zoom-in active:[transform:scale(.99)] reveal-on-scroll";
const masonryColumns = ["columns-1", "columns-2", "columns-3 max-[1000px]:columns-2"];

/** Chapters of one tournament: a wide lead photo, then a masonry of the rest. */
export default function TournamentGallery({ tournamentId }: { tournamentId: string }) {
  const gallery = findGallery(tournamentId);
  const photos = galleryPhotos(gallery);
  const [index, setIndex] = useState<number | null>(null);
  const tile = (photo: GalleryPhoto, lead = false) => <button key={photo.id} type="button"
    className={cn(tileClass, lead ? "rounded-[18px] mb-4 mobile:rounded-[14px] mobile:mb-2.5" : "break-inside-avoid mb-4 mobile:mb-2.5 mobile:rounded-[10px]")}
    onClick={() => setIndex(photos.indexOf(photo))}
    aria-label={`查看大图：${photo.caption ?? photo.alt}`}>
    <Image src={photo.image} alt={photo.alt} placeholder="blur"
      className={cn("block w-full h-auto [transition:transform_.8s_var(--ease-apple),filter_.8s_var(--ease-apple)] group-hover:[transform:scale(1.035)]", lead && "aspect-[16/9] object-cover mobile:aspect-[4/3]")}
      sizes={lead ? "(max-width: 1240px) 100vw, 1200px" : "(max-width: 1000px) 50vw, 400px"} />
    <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 pt-10 px-[18px] pb-3.5 bg-[linear-gradient(transparent,rgb(0_0_0/62%))] text-white text-[14px] font-[550] text-left opacity-0 [transform:translateY(6px)] [transition:opacity_.35s_var(--ease-apple),transform_.35s_var(--ease-apple)] group-hover:opacity-100 group-hover:[transform:none] group-focus-visible:opacity-100 group-focus-visible:[transform:none] mobile:hidden">{photo.caption}<Expand size={15} aria-hidden="true" /></span>
  </button>;
  return <>
    <nav className="sticky top-14 z-20 bg-[rgb(11_11_13/72%)] [backdrop-filter:saturate(180%)_blur(20px)] border-b border-[rgb(255_255_255/10%)] mobile:top-[52px]" aria-label="相册章节">
      <div className="max-w-[1200px] mx-auto py-2.5 px-10 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden mobile:px-4 mobile:py-2">
        {gallery.chapters.map((chapter, i) => <a key={chapter.id} href={`#${chapter.id}`} className="inline-flex items-center gap-2 shrink-0 py-[7px] px-3.5 rounded-[999px] text-g-soft text-[14px] hover:bg-[rgb(255_255_255/9%)] hover:text-white">
          <span className="text-g-muted text-[11px] tabular-nums">{String(i + 1).padStart(2, "0")}</span>{chapter.title}<small className="text-g-muted text-[12px]">{chapter.photos.length}</small>
        </a>)}
      </div>
    </nav>
    <div className={galleryWrap}>
      {gallery.chapters.map((chapter, i) => {
        const [lead, ...rest] = chapter.photos;
        return <section className="pt-24 scroll-mt-[110px] mobile:pt-16" id={chapter.id} key={chapter.id} aria-labelledby={`${chapter.id}-title`}>
          <header className="grid grid-cols-[auto_1fr_auto] [align-items:end] gap-7 mb-8 reveal-on-scroll mobile:grid-cols-[1fr] mobile:gap-2.5 mobile:mb-[22px]">
            <span className="text-[72px] font-[650] leading-[.8] tracking-[-0.05em] text-transparent [-webkit-text-stroke:1px_rgb(255_255_255/35%)] tabular-nums mobile:text-[44px]">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <p className={galleryKicker}>{chapter.en}</p>
              <h2 id={`${chapter.id}-title`} className="text-[clamp(30px,4vw,44px)] mt-1.5 mb-2">{chapter.title}</h2>
              <p className="text-g-muted text-[16px] leading-[1.7] max-w-[52ch]">{chapter.description}</p>
            </div>
            <span className="text-g-muted text-[13px] whitespace-nowrap mobile:hidden">{chapter.photos.length} 张</span>
          </header>
          {tile(lead, true)}
          {rest.length > 0 && <div className={cn("gap-x-4 mobile:gap-x-2.5", masonryColumns[Math.min(rest.length, 3) - 1])}>{rest.map(photo => tile(photo))}</div>}
        </section>;
      })}
    </div>
    <PhotoLightbox photos={photos} index={index} onIndexChange={setIndex} title={`${gallery.name} · 赛事相册`} />
  </>;
}
