export default function PlayerRating({ rating }: { rating: number }) {
  return (
    <span className="player-rating" aria-label={`Rating v2 ${rating.toFixed(2)}`}>
      <span>RT</span> {rating.toFixed(2)}
    </span>
  );
}
