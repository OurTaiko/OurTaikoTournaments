import { playerRating } from "@/components/styles";

export default function PlayerRating({ rating }: { rating: number }) {
  return (
    <span className={playerRating} aria-label={`Rating v2 ${rating.toFixed(2)}`}>
      <span className="text-[#747b87] text-[9px] tracking-[0.04em]">RT</span> {rating.toFixed(2)}
    </span>
  );
}
