import Image from "next/image";
import Link from "next/link";
import { footer, footerBrand } from "@/components/styles";
import { cn } from "@/lib/utils";

export default function SiteFooter({ className, note = "因热爱相聚，为每一次全力以赴。" }: { className?: string; note?: string }) {
  return <footer className={cn(footer, className)}>
    <Link href="/" className={cn(footerBrand, "text-foreground font-semibold")}>
      <Image src="/ourtaiko/ourtaiko-192.png" alt="" width={24} height={24} />OurTaiko Tournaments
    </Link>
    <div className="flex flex-wrap gap-x-5 gap-y-2"><span>{note}</span><a href="/ourtaiko/NOTICE" className="underline underline-offset-4 hover:text-taiko-blue">素材致谢</a></div>
  </footer>;
}
