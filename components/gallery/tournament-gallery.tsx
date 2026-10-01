"use client";
import Image from "next/image";
import { useState } from "react";
import { Expand } from "lucide-react";
import PhotoLightbox from "@/components/gallery/photo-lightbox";
import { findGallery, galleryPhotos, type GalleryPhoto } from "@/lib/gallery";

/** Chapters of one tournament: a wide lead photo, then a masonry of the rest. */
export default function TournamentGallery({ tournamentId }: { tournamentId: string }) {
  const gallery = findGallery(tournamentId);
  const photos = galleryPhotos(gallery);
  const [index, setIndex] = useState<number | null>(null);
  const tile = (photo: GalleryPhoto, lead = false) => <button key={photo.id} type="button"
    className={`gallery-tile${lead ? " gallery-lead" : ""}`} onClick={() => setIndex(photos.indexOf(photo))}
    aria-label={`查看大图：${photo.caption ?? photo.alt}`}>
    <Image src={photo.image} alt={photo.alt} placeholder="blur"
      sizes={lead ? "(max-width: 1240px) 100vw, 1200px" : "(max-width: 1000px) 50vw, 400px"} />
    <span className="gallery-tile-caption">{photo.caption}<Expand size={15} aria-hidden="true" /></span>
  </button>;
  return <>
    <nav className="gallery-chapter-nav" aria-label="相册章节">
      <div className="gallery-chapter-nav-inner">
        {gallery.chapters.map((chapter, i) => <a key={chapter.id} href={`#${chapter.id}`}>
          <span>{String(i + 1).padStart(2, "0")}</span>{chapter.title}<small>{chapter.photos.length}</small>
        </a>)}
      </div>
    </nav>
    <div className="gallery-wrap">
      {gallery.chapters.map((chapter, i) => {
        const [lead, ...rest] = chapter.photos;
        return <section className="gallery-chapter" id={chapter.id} key={chapter.id} aria-labelledby={`${chapter.id}-title`}>
          <header className="gallery-chapter-head">
            <span className="gallery-chapter-no">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <p className="gallery-kicker">{chapter.en}</p>
              <h2 id={`${chapter.id}-title`}>{chapter.title}</h2>
              <p className="gallery-chapter-text">{chapter.description}</p>
            </div>
            <span className="gallery-chapter-count">{chapter.photos.length} 张</span>
          </header>
          {tile(lead, true)}
          {rest.length > 0 && <div className={`gallery-masonry${rest.length < 3 ? ` count-${rest.length}` : ""}`}>{rest.map(photo => tile(photo))}</div>}
        </section>;
      })}
    </div>
    <PhotoLightbox photos={photos} index={index} onIndexChange={setIndex} title={`${gallery.name} · 赛事相册`} />
  </>;
}
