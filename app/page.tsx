import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, CalendarDays, Cat, Drum, Images, Trophy } from "lucide-react";
import AccountLink from "@/components/account-link";
import SiteBrand from "@/components/site-brand";
import SiteFooter from "@/components/site-footer";
import * as s from "@/components/styles";
import { cn } from "@/lib/utils";
import { tournaments } from "@/lib/tournaments";

export default function TournamentDirectory() {
  return <>
    <header className={s.topbar}><div className={s.topbarInner}>
      <SiteBrand />
      <nav aria-label="主导航" className="ml-auto flex items-center gap-7 text-[14px] mobile:hidden">
        <a href="#tournaments" className="hover:text-primary">赛事一览</a><Link href="/gallery" className="hover:text-taiko-blue">赛事相册</Link>
      </nav>
      <AccountLink />
    </div></header>
    <main>
      <section className="relative isolate overflow-hidden bg-card" aria-labelledby="directory-title">
        <Image src="/ourtaiko/bg.webp" alt="" fill preload sizes="100vw" className="-z-20 object-cover opacity-35" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,#fffef9_20%,#fffef9e8_50%,#fffef966_100%)]" />
        <div className="relative max-w-[1180px] mx-auto px-7 pt-[72px] pb-[78px] text-center mobile:px-[18px] mobile:pt-12 mobile:pb-14">
          <Image src="/ourtaiko/sticker_1.png" alt="" width={156} height={156} className="absolute left-7 top-28 h-auto w-[13%] -rotate-12 max-[950px]:hidden" />
          <Image src="/ourtaiko/sticker_2.png" alt="" width={156} height={156} className="absolute right-7 bottom-20 h-auto w-[13%] rotate-12 max-[950px]:hidden" />
          <p className="text-taiko-blue text-[12px] font-bold tracking-[0.2em] mobile:text-[10px]">OURTAIKO TOURNAMENTS</p>
          <h1 id="directory-title" className="mt-5 text-[clamp(36px,5.8vw,68px)] font-bold leading-[1.28]">因热爱<span className="text-taiko-red">相聚</span>，<br />为每一场<span className="text-taiko-blue">对决</span>喝彩。</h1>
          <p className="max-w-[48ch] mt-6 mx-auto text-muted-foreground text-[16px] leading-[1.85] mobile:text-[14px]">发现 OurTaiko 社区赛事。<br />从赛场对阵到精彩回顾，记录每一次全力以赴。</p>
          <div className="flex flex-wrap justify-center gap-4 mt-8">
            <a className={s.primaryButton} href="#tournaments">浏览赛事<ArrowDown size={16} /></a>
            <Link className={cn(s.secondaryButton, "text-[14px]")} href="/gallery"><Images size={16} />赛事相册</Link>
          </div>
        </div>
        <div aria-hidden="true" className="h-2 bg-[repeating-linear-gradient(90deg,#dc4839_0px,#dc4839_44px,#fffef9_44px,#fffef9_48px,#087c95_48px,#087c95_92px,#fffef9_92px,#fffef9_96px)]" />
      </section>
      <div className={s.container}>
        <section id="tournaments" className="pt-16 pb-6 scroll-mt-6 mobile:pt-10" aria-labelledby="events-title">
          <div className="flex items-end justify-between gap-4 mb-7">
            <div><p className="text-taiko-blue text-[11px] tracking-[0.18em] font-semibold">MEET AT THE ARCADE</p><h2 id="events-title" className="mt-1 text-[30px] mobile:text-[26px]">赛场见！</h2></div>
            <span className="text-muted-foreground text-[13px] pb-1">{tournaments.length} 场社区赛事</span>
          </div>
          <div className="grid grid-cols-2 gap-6 mobile:grid-cols-1">
            {tournaments.map((event, index) => <article className="flex flex-col min-w-0 overflow-hidden rounded-[15px] border border-line bg-card shadow-[0_4px_0_#e7dfd4]" key={event.id}>
              <div className={cn("flex items-center justify-between gap-5 px-7 py-6 border-b border-line", event.archived ? "bg-soft-purple" : "bg-soft-blue")}>
                <div><p className="text-[11px] tracking-[0.16em] text-muted-foreground">{String(index + 1).padStart(2, "0")} / {event.series.toUpperCase()}</p><p className="text-[14px] mt-1 font-semibold">{event.archived ? "鼓声未远，精彩留存" : "下一场对决，等你到场"}</p></div>
                {event.archived ? <Cat size={42} strokeWidth={1.5} className="text-ink" aria-hidden="true" /> : <Drum size={42} strokeWidth={1.5} className="text-taiko-blue" aria-hidden="true" />}
              </div>
              <div className="flex flex-1 flex-col p-7 mobile:p-6">
                <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">{event.archived ? <Trophy size={14} /> : <CalendarDays size={14} />}{event.archived ? "赛果存档" : "赛事赛程"}</div>
                <h3 className="mt-2 text-[25px] leading-[1.4] phone:text-[22px]">{event.name}</h3>
                <p className="mt-4 mb-6 text-muted-foreground text-[14px] leading-[1.85]">{event.description}</p>
                <div className="mt-auto pt-5 border-t border-line flex flex-wrap items-center justify-between gap-4">
                  <time className="inline-flex items-center gap-2 text-muted-foreground text-[12px]" dateTime={event.date}><CalendarDays size={15} />{event.displayDate}</time>
                  <Link className={cn(event.archived ? s.secondaryButton : s.primaryButton, "px-4 text-[13px]")} href={event.href} aria-label={`${event.archived ? "回顾赛果" : "查看赛事"}：${event.name}`}>{event.archived ? "回顾赛果" : "查看赛事"}<ArrowRight size={16} /></Link>
                </div>
              </div>
            </article>)}
          </div>
        </section>
        <section className="flex flex-wrap items-center justify-between gap-5 border-y border-line py-8 mt-10" aria-labelledby="memories-title">
          <div className="flex items-center gap-4"><Images size={30} className="text-taiko-blue" aria-hidden="true" /><div><h2 id="memories-title" className="text-[20px]">比赛之外，也有值得珍藏的瞬间。</h2><p className="mt-1 text-[14px] text-muted-foreground">赛场、对决、颁奖与相聚，在照片里再见。</p></div></div>
          <Link href="/gallery" className={s.textButton}>翻开赛事相册<ArrowRight size={16} /></Link>
        </section>
        <SiteFooter className="border-t-0 mt-0" />
      </div>
    </main>
  </>;
}
