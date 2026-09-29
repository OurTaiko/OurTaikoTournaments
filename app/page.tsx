import Link from "next/link";
import { ArrowUpRight, CalendarDays, Cat, Drum, Trophy } from "lucide-react";
import AccountLink from "@/components/account-link";
import { tournaments } from "@/lib/tournaments";

export default function TournamentDirectory() {
  return <>
    <header className="topbar"><div className="topbar-inner">
      <Link className="brand" href="/"><span className="brand-icon"><Trophy size={25} /></span>OurTaiko<span className="edition">赛事</span></Link>
      <AccountLink />
    </div></header>
    <main className="tournament-directory">
      <section className="directory-hero" aria-labelledby="directory-title">
        <h1 id="directory-title">每一场对决，<br />都值得记录。</h1>
        <p>发现 OurTaiko 社区赛事。<br />从赛场对阵到精彩回顾，在这里找到属于你的比赛。</p>
        <a className="primary-button" href="#tournaments">浏览赛事<ArrowUpRight size={16} /></a>
      </section>
      <section id="tournaments" className="directory-events" aria-labelledby="events-title">
        <div className="directory-heading"><h2 id="events-title">赛事一览</h2><span>{tournaments.length} 场赛事</span></div>
        {tournaments.map(event => <Link className="directory-event group" href={event.href} key={event.id}>
          <div className="directory-event-icon">{event.seriesSlug === "centurylink" ? <Drum size={46} /> : <Cat size={48} />}</div>
          <div className="directory-event-body"><p className="directory-series">{event.series}</p><h3>{event.name}</h3>
            <p className="directory-description">{event.description}</p>
            <time dateTime={event.date}><CalendarDays size={16} />{event.displayDate}</time>
          </div><span className="directory-event-link">查看赛事<ArrowUpRight size={18} /></span>
        </Link>)}
      </section>
      <footer className="directory-footer"><span>OurTaiko Tournaments</span><span>因热爱相聚，为每一次全力以赴。</span></footer>
    </main>
  </>;
}
