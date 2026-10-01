import Link from "next/link";
import { ArrowUpRight, CalendarDays, Cat, Drum, Images, Trophy } from "lucide-react";
import AccountLink from "@/components/account-link";
import { brand, brandIcon, edition, footerBrand, galleryButton, primaryButton, topbar, topbarInner } from "@/components/styles";
import { cn } from "@/lib/utils";
import { tournaments } from "@/lib/tournaments";

export default function TournamentDirectory() {
  return <>
    <header className={topbar}><div className={topbarInner}>
      <Link className={brand} href="/"><span className={brandIcon}><Trophy size={25} /></span>OurTaiko<span className={edition}>赛事</span></Link>
      <AccountLink />
    </div></header>
    <main className="max-w-[980px] m-auto px-8 phone:px-6">
      <section className="pt-28 pb-24 text-center phone:py-20" aria-labelledby="directory-title">
        <h1 id="directory-title" className="text-[clamp(40px,6vw,68px)] leading-[1.15] text-black">每一场对决，<br />都值得记录。</h1>
        <p className="max-w-[65ch] mt-7 mx-auto mb-8 text-[#6e6e73] text-[18px] leading-[1.8] phone:text-[16px]">发现 OurTaiko 社区赛事。<br />从赛场对阵到精彩回顾，在这里找到属于你的比赛。</p>
        <div className="flex flex-wrap justify-center gap-3">
          <a className={primaryButton} href="#tournaments">浏览赛事<ArrowUpRight size={16} /></a>
          <Link className={cn(galleryButton, "mt-0 min-h-11 py-3 px-6")} href="/gallery"><Images size={16} />赛事相册<ArrowUpRight size={15} /></Link>
        </div>
      </section>
      <section id="tournaments" aria-labelledby="events-title">
        <div className="flex items-baseline justify-between gap-4 mb-6"><h2 id="events-title" className="text-[28px]">赛事一览</h2><span className="text-[#6e6e73] text-[14px]">{tournaments.length} 场赛事</span></div>
        {tournaments.map(event => <Link className="group flex items-center gap-8 p-10 rounded-[16px] bg-white shadow-[0_4px_12px_rgb(0_0_0/8%)] phone:flex-wrap phone:p-7 phone:gap-6" href={event.href} key={event.id}>
          <div className="text-primary [&_svg]:[transition:transform_500ms_var(--ease-apple)] group-hover:[&_svg]:[transform:scale(1.05)]">{event.seriesSlug === "centurylink" ? <Drum size={46} /> : <Cat size={48} />}</div>
          <div className="flex-1 min-w-0 phone:basis-[calc(100%-80px)]"><p className="text-[#6e6e73] text-[14px] mb-2">{event.series}</p><h3 className="text-black text-[28px] phone:text-[23px]">{event.name}</h3>
            <p className="max-w-[65ch] text-[#6e6e73] text-[15px] leading-[1.8] mt-4 mb-6">{event.description}</p>
            <time className="flex items-center gap-2 text-[#6e6e73] text-[13px]" dateTime={event.date}><CalendarDays size={16} />{event.displayDate}</time>
          </div><span className="flex items-center gap-1.5 text-primary text-[14px] whitespace-nowrap group-hover:underline phone:w-full phone:justify-end">查看赛事<ArrowUpRight size={18} /></span>
        </Link>)}
      </section>
      <footer className="flex justify-between gap-5 mt-8 pt-16 pb-8 border-t border-line text-[#6e6e73] text-[12px] mobile:flex-col"><span className={footerBrand}>OurTaiko Tournaments</span><span>因热爱相聚，为每一次全力以赴。</span></footer>
    </main>
  </>;
}
