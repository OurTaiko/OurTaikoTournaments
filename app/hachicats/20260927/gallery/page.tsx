import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUpRight, CalendarDays, Camera, MapPin } from "lucide-react";
import GalleryTopbar from "@/components/gallery/gallery-topbar";
import TournamentGallery from "@/components/gallery/tournament-gallery";
import * as s from "@/components/styles";
import { findGallery, galleryPhotos } from "@/lib/gallery";
import { HACHICATS_TOURNAMENT_ID } from "@/lib/tournaments";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "赛事相册 · 第一届八猫杯",
  description: "2026 年 9 月 27 日第一届八猫杯现场照片：赛场、对决、颁奖与相聚。",
};

export default function HachiCatsGallery() {
  const gallery = findGallery(HACHICATS_TOURNAMENT_ID);
  return <div className={s.galleryPage} data-gallery-page>
    <GalleryTopbar><Link href={gallery.tournamentHref}>赛果存档</Link></GalleryTopbar>
    <main>
      <section className="relative flex items-end min-h-[min(86svh,820px)] overflow-hidden isolate after:content-[''] after:absolute after:inset-0 after:-z-1 after:bg-[linear-gradient(90deg,rgb(11_11_13/72%)_0%,rgb(11_11_13/30%)_55%,transparent_80%),linear-gradient(180deg,rgb(11_11_13/35%)_0%,transparent_28%,rgb(11_11_13/62%)_60%,var(--color-g-bg)_100%)] mobile:min-h-[78svh]" aria-labelledby="gallery-title">
        <Image className="-z-2 object-cover animate-gallery-hero" src={gallery.cover.image} alt={gallery.cover.alt} placeholder="blur" fill preload sizes="100vw" />
        <div className={cn(s.galleryWrap, "w-full pb-16 grid gap-[18px] justify-items-start mobile:pb-10 mobile:gap-3.5")}>
          <p className={cn(s.galleryKicker, "animate-gallery-rise")}>{gallery.series} · GALLERY</p>
          <h1 id="gallery-title" className="text-[clamp(44px,7vw,88px)] leading-[1.04] tracking-[-0.045em] [text-shadow:0_2px_30px_rgb(0_0_0/35%)] animate-gallery-rise-1">{gallery.name}</h1>
          <p className={cn(s.galleryLede, "animate-gallery-rise-2")}>{gallery.summary}</p>
          <div className={cn(s.galleryMeta, "animate-gallery-rise-3")}>
            <span className={s.galleryMetaItem}><CalendarDays size={15} />{gallery.displayDate}</span>
            <span className={s.galleryMetaItem}><MapPin size={15} />{gallery.location}</span>
            <span className={s.galleryMetaItem}><Camera size={15} />{galleryPhotos(gallery).length} 张照片</span>
          </div>
          <div className="flex flex-wrap gap-3 mt-2 animate-gallery-rise-3">
            <a className={s.galleryPill} href={`#${gallery.chapters[0].id}`}>开始浏览<ArrowDown size={16} /></a>
            <Link className={cn(s.galleryPill, s.galleryPillGhost)} href={gallery.tournamentHref}>查看赛果<ArrowUpRight size={16} /></Link>
          </div>
        </div>
      </section>
      <TournamentGallery tournamentId={gallery.tournamentId} />
      <footer className={cn(s.galleryWrap, s.galleryFooter)}><span className={s.footerBrand}>HachiCats · 第一届八猫杯 · 赛事相册</span><span>照片版权归拍摄者及主办方所有</span></footer>
    </main>
  </div>;
}
