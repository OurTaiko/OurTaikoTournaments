import Link from "next/link";
import { Images, Trophy } from "lucide-react";

export default function GalleryTopbar({ children, index = false }: { children?: React.ReactNode; index?: boolean }) {
  return <header className="topbar gallery-topbar"><div className="topbar-inner">
    <Link className="brand" href="/"><span className="brand-icon"><Trophy size={25} /></span>OurTaiko<span className="edition">赛事</span></Link>
    <nav className="gallery-topbar-links" aria-label="相册导航">
      {children}
      {!index && <Link href="/gallery"><Images size={16} />全部相册</Link>}
    </nav>
  </div></header>;
}
