function label(rating: number) {
  if (rating >= 9) return "Superb";
  if (rating >= 8.5) return "Excellent";
  if (rating >= 8) return "Very good";
  return "Good";
}

export default function ReviewScore({ rating, reviewCount }: { rating: number; reviewCount: number }) {
  return (
    <span className="flex items-center gap-2 rounded-full bg-white/95 py-1 pr-3 pl-1 text-sm shadow-sm">
      <span className="rounded-full bg-ink px-2 py-0.5 text-xs font-bold text-white tabular-nums">
        {rating.toFixed(1)}
      </span>
      <span className="font-semibold text-ink">{label(rating)}</span>
      <span className="text-xs text-ink-muted">({reviewCount.toLocaleString("en-US")})</span>
    </span>
  );
}
