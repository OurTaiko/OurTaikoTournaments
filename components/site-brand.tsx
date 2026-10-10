import Image from "next/image";
import Link from "next/link";
import { brand, edition } from "@/components/styles";

export default function SiteBrand() {
  return <Link className={brand} href="/" aria-label="OurTaiko 赛事首页">
    <Image src="/ourtaiko/ourtaiko-192.png" alt="" width={36} height={36} className="shrink-0" />
    <span>OurTaiko</span><span className={edition}>赛事</span>
  </Link>;
}
