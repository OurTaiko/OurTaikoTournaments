import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUpRight, CalendarDays, Camera, MapPin } from "lucide-react";
import GalleryTopbar from "@/components/gallery/gallery-topbar";
import TournamentGallery from "@/components/gallery/tournament-gallery";
import { findGallery, galleryPhotos } from "@/lib/gallery";
import { HACHICATS_TOURNAMENT_ID } from "@/lib/tournaments";
import "@/components/gallery/gallery.css";

export const metadata: Metadata = {
  title: "赛事相册 · 第一届八猫杯",
  description: "2026 年 9 月 27 日第一届八猫杯现场照片：赛场、对决、颁奖与相聚。",
};

export default function HachiCatsGallery() {
  const gallery = findGallery(HACHICATS_TOURNAMENT_ID);
  return <div className="gallery-page">
    <GalleryTopbar><Link href={gallery.tournamentHref}>赛果存档</Link></GalleryTopbar>
    <main>
      <section className="gallery-hero" aria-labelledby="gallery-title">
        <Image className="gallery-hero-image" src={gallery.cover.image} alt={gallery.cover.alt} placeholder="blur" fill preload sizes="100vw" />
        <div className="gallery-hero-content gallery-wrap">
          <p className="gallery-kicker">{gallery.series} · GALLERY</p>
          <h1 id="gallery-title">{gallery.name}</h1>
          <p className="gallery-lede">{gallery.summary}</p>
          <div className="gallery-meta">
            <span><CalendarDays size={15} />{gallery.displayDate}</span>
            <span><MapPin size={15} />{gallery.location}</span>
            <span><Camera size={15} />{galleryPhotos(gallery).length} 张照片</span>
          </div>
          <div className="gallery-hero-actions">
            <a className="gallery-pill" href={`#${gallery.chapters[0].id}`}>开始浏览<ArrowDown size={16} /></a>
            <Link className="gallery-pill ghost" href={gallery.tournamentHref}>查看赛果<ArrowUpRight size={16} /></Link>
          </div>
        </div>
      </section>
      <TournamentGallery tournamentId={gallery.tournamentId} />
      <footer className="gallery-footer gallery-wrap"><span>HachiCats · 第一届八猫杯 · 赛事相册</span><span>照片版权归拍摄者及主办方所有</span></footer>
    </main>
  </div>;
}
