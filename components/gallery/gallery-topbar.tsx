import Link from "next/link";
import { Images, Trophy } from "lucide-react";
import { brand, brandIcon, edition, topbarInner } from "@/components/styles";
import { cn } from "@/lib/utils";

export default function GalleryTopbar({ children, index = false }: { children?: React.ReactNode; index?: boolean }) {
  return <header className="sticky top-0 z-30 bg-[rgb(11_11_13/72%)] border-b border-[rgb(255_255_255/10%)] [backdrop-filter:saturate(180%)_blur(20px)]"><div className={cn(topbarInner, "max-w-[1200px] h-14 mobile:px-4 mobile:h-[52px]")}>
    <Link className={cn(brand, "text-[18px] mobile:text-[18px]")} href="/"><span className={cn(brandIcon, "text-g-accent")}><Trophy size={25} /></span>OurTaiko<span className={cn(edition, "border-[rgb(255_255_255/10%)] text-g-muted")}>赛事</span></Link>
    <nav className="ml-auto flex items-center gap-[22px] text-[13px] text-g-soft mobile:gap-4 [&_a]:inline-flex [&_a]:items-center [&_a]:gap-1.5 [&_a:hover]:text-white" aria-label="相册导航">
      {children}
      {!index && <Link href="/gallery"><Images size={16} />全部相册</Link>}
    </nav>
  </div></header>;
}
