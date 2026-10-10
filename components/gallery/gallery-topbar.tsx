import Link from "next/link";
import { Images } from "lucide-react";
import SiteBrand from "@/components/site-brand";
import { topbar, topbarInner } from "@/components/styles";
import { cn } from "@/lib/utils";

export default function GalleryTopbar({ children, index = false }: { children?: React.ReactNode; index?: boolean }) {
  return <header className={cn(topbar, "sticky top-0 z-30")}><div className={cn(topbarInner, "min-h-14 mobile:min-h-[60px] max-[420px]:flex-wrap max-[420px]:py-3 max-[420px]:gap-2")}>
    <SiteBrand />
    <nav className="ml-auto flex items-center gap-5 text-[13px] text-muted-foreground mobile:gap-3 [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_a]:gap-1.5 [&_a:hover]:text-taiko-blue" aria-label="相册导航">
      {children}
      {!index && <Link href="/gallery"><Images size={16} />全部相册</Link>}
    </nav>
  </div></header>;
}
