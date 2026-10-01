import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, Camera, MapPin } from "lucide-react";
import GalleryRail from "@/components/gallery/gallery-rail";
import GalleryTopbar from "@/components/gallery/gallery-topbar";
import { galleries, galleryPhotos } from "@/lib/gallery";
import { tournaments } from "@/lib/tournaments";
import "@/components/gallery/gallery.css";

export const metadata: Metadata = {
  title: "赛事相册 · OurTaiko Tournaments",
  description: "OurTaiko 社区赛事的现场照片，按赛事浏览。",
};

export default function GalleryIndex() {
  const photoCount = galleries.reduce((sum, gallery) => sum + galleryPhotos(gallery).length, 0);
  const upcoming = tournaments.filter(event => !galleries.some(gallery => gallery.tournamentId === event.id));
  return <div className="gallery-page">
    <GalleryTopbar index><Link href="/">赛事目录</Link></GalleryTopbar>
    <main>
      <section className="gallery-index-hero gallery-wrap" aria-labelledby="gallery-title">
        <p className="gallery-kicker">OURTAIKO GALLERY</p>
        <h1 id="gallery-title">镜头里的，<br />每一场相聚。</h1>
        <p className="gallery-lede">鼓声落下之后，照片替我们记得。按赛事回看 OurTaiko 社区的每一个现场。</p>
        <div className="gallery-stats">
          <span><b>{galleries.length}</b>场赛事</span>
          <span><b>{photoCount}</b>张照片</span>
        </div>
      </section>
      {galleries.map(gallery => <section className="gallery-event" key={gallery.tournamentId} aria-labelledby={`${gallery.tournamentId}-title`}>
        <div className="gallery-wrap">
          <Link className="gallery-event-cover" href={gallery.href}>
            <Image src={gallery.cover.image} alt={gallery.cover.alt} placeholder="blur" fill preload
              sizes="(max-width: 1240px) 100vw, 1200px" />
            <div className="gallery-event-overlay">
              <p className="gallery-kicker">{gallery.series}</p>
              <h2 id={`${gallery.tournamentId}-title`}>{gallery.name}</h2>
              <div className="gallery-meta">
                <span><CalendarDays size={15} />{gallery.displayDate}</span>
                <span><MapPin size={15} />{gallery.location}</span>
                <span><Camera size={15} />{galleryPhotos(gallery).length} 张照片</span>
              </div>
              <span className="gallery-pill">打开相册<ArrowUpRight size={16} /></span>
            </div>
          </Link>
          <div className="gallery-event-strip-head">
            <p>{gallery.summary}</p>
            <Link href={gallery.tournamentHref}>查看赛果<ArrowUpRight size={15} /></Link>
          </div>
        </div>
        <GalleryRail tournamentId={gallery.tournamentId} />
      </section>)}
      {upcoming.length > 0 && <section className="gallery-wrap gallery-upcoming" aria-labelledby="upcoming-title">
        <h2 id="upcoming-title">即将到来</h2>
        {upcoming.map(event => <Link key={event.id} href={event.href} className="gallery-upcoming-item">
          <div><p className="gallery-kicker">{event.series}</p><h3>{event.name}</h3></div>
          <span><CalendarDays size={15} />{event.displayDate} · 赛后更新照片</span>
        </Link>)}
      </section>}
      <footer className="gallery-footer gallery-wrap"><span>OurTaiko Tournaments · 赛事相册</span><span>照片版权归拍摄者及主办方所有</span></footer>
    </main>
  </div>;
}
