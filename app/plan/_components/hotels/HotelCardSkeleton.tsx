const bar = "rounded-full bg-lavender-soft/70";

/** Placeholder with the outline of a hotel card, shown while a search is running. */
export default function HotelCardSkeleton() {
  return (
    <li
      aria-hidden
      className="animate-pulse overflow-hidden rounded-3xl border border-lavender-soft/70 bg-white motion-reduce:animate-none"
    >
      <div className="h-40 bg-lavender-soft/50" />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className={`${bar} h-5 w-40`} />
            <div className={`${bar} h-3 w-20`} />
            <div className={`${bar} h-3 w-32`} />
          </div>
          <div className={`${bar} h-7 w-16`} />
        </div>
        <div className="mt-4 flex gap-1.5">
          <div className={`${bar} h-6 w-16`} />
          <div className={`${bar} h-6 w-12`} />
        </div>
        <div className={`${bar} mt-4 h-11 w-full`} />
      </div>
    </li>
  );
}
