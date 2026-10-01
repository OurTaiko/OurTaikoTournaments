import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, Camera, MapPin } from "lucide-react";
import GalleryRail from "@/components/gallery/gallery-rail";
import GalleryTopbar from "@/components/gallery/gallery-topbar";
import * as s from "@/components/styles";
import { galleries, galleryPhotos } from "@/lib/gallery";
import { tournaments } from "@/lib/tournaments";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "赛事相册 · OurTaiko Tournaments",
  description: "OurTaiko 社区赛事的现场照片，按赛事浏览。",
};

export default function GalleryIndex() {
  const photoCount = galleries.reduce((sum, gallery) => sum + galleryPhotos(gallery).length, 0);
  const upcoming = tournaments.filter(event => !galleries.some(gallery => gallery.tournamentId === event.id));
  return <div className={s.galleryPage} data-gallery-page>
    <GalleryTopbar index><Link href="/">赛事目录</Link></GalleryTopbar>
    <main>
      <section className={cn(s.galleryWrap, "pt-24 pb-16 text-center grid justify-items-center gap-[22px] mobile:pt-[72px] mobile:pb-14")} aria-labelledby="gallery-title">
        <p className={cn(s.galleryKicker, "animate-gallery-rise")}>OURTAIKO GALLERY</p>
        <h1 id="gallery-title" className="text-[clamp(42px,6.4vw,76px)] leading-[1.12] tracking-[-0.045em] animate-gallery-rise-1">镜头里的，<br />每一场相聚。</h1>
        <p className={cn(s.galleryLede, "animate-gallery-rise-2")}>鼓声落下之后，照片替我们记得。按赛事回看 OurTaiko 社区的每一个现场。</p>
        <div className="flex gap-10 mt-2 text-g-muted text-[13px] animate-gallery-rise-2">
          <span className={statClass}><b className={statValue}>{galleries.length}</b>场赛事</span>
          <span className={statClass}><b className={statValue}>{photoCount}</b>张照片</span>
        </div>
      </section>
      {galleries.map(gallery => <section className="pb-24 mobile:pb-[72px]" key={gallery.tournamentId} aria-labelledby={`${gallery.tournamentId}-title`}>
        <div className={s.galleryWrap}>
          <Link className="group relative flex items-end aspect-[16/8] min-h-[380px] rounded-[24px] overflow-hidden isolate active:[transform:none] after:content-[''] after:absolute after:inset-0 after:-z-1 after:bg-[linear-gradient(180deg,transparent_35%,rgb(0_0_0/78%))] mobile:aspect-[4/5] mobile:min-h-0 mobile:rounded-[18px]" href={gallery.href}>
            <Image src={gallery.cover.image} alt={gallery.cover.alt} placeholder="blur" fill preload
              className="-z-2 object-cover [transition:transform_1.2s_var(--ease-apple)] group-hover:[transform:scale(1.03)]"
              sizes="(max-width: 1240px) 100vw, 1200px" />
            <div className="grid justify-items-start gap-3 p-10 mobile:p-6">
              <p className={cn(s.galleryKicker, "text-g-soft")}>{gallery.series}</p>
              <h2 id={`${gallery.tournamentId}-title`} className="text-[clamp(32px,4.6vw,54px)] tracking-[-0.04em]">{gallery.name}</h2>
              <div className={s.galleryMeta}>
                <span className={s.galleryMetaItem}><CalendarDays size={15} />{gallery.displayDate}</span>
                <span className={s.galleryMetaItem}><MapPin size={15} />{gallery.location}</span>
                <span className={s.galleryMetaItem}><Camera size={15} />{galleryPhotos(gallery).length} 张照片</span>
              </div>
              <span className={cn(s.galleryPill, "mt-1.5 group-hover:bg-white")}>打开相册<ArrowUpRight size={16} /></span>
            </div>
          </Link>
          <div className="flex justify-between items-baseline gap-5 mt-7 mb-4 text-g-muted text-[15px] mobile:flex-col mobile:gap-2">
            <p>{gallery.summary}</p>
            <Link href={gallery.tournamentHref} className="inline-flex items-center gap-[5px] text-g-accent whitespace-nowrap text-[14px] hover:underline">查看赛果<ArrowUpRight size={15} /></Link>
          </div>
        </div>
        <GalleryRail tournamentId={gallery.tournamentId} />
      </section>)}
      {upcoming.length > 0 && <section className={cn(s.galleryWrap, "pb-10")} aria-labelledby="upcoming-title">
        <h2 id="upcoming-title" className="text-[24px] mb-[18px]">即将到来</h2>
        {upcoming.map(event => <Link key={event.id} href={event.href} className="flex justify-between items-center gap-5 py-[26px] px-[30px] border border-dashed border-[rgb(255_255_255/18%)] rounded-[18px] not-first-of-type:mt-3 hover:border-[rgb(255_255_255/34%)] hover:bg-[rgb(255_255_255/3%)] mobile:flex-col mobile:items-start mobile:p-[22px]">
          <div><p className={s.galleryKicker}>{event.series}</p><h3 className="text-[22px] mt-1.5">{event.name}</h3></div>
          <span className="inline-flex items-center gap-[7px] text-g-muted text-[14px]"><CalendarDays size={15} />{event.displayDate} · 赛后更新照片</span>
        </Link>)}
      </section>}
      <footer className={cn(s.galleryWrap, s.galleryFooter)}><span className={s.footerBrand}>OurTaiko Tournaments · 赛事相册</span><span>照片版权归拍摄者及主办方所有</span></footer>
    </main>
  </div>;
}

const statClass = "grid justify-items-center gap-0.5";
const statValue = "text-g-text text-[34px] font-semibold tracking-[-0.03em] tabular-nums";
