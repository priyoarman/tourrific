const bar = "rounded-full bg-lavender-soft/70";

function LegSkeleton() {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-2">
        <div className={`${bar} h-5 w-14`} />
        <div className={`${bar} h-3 w-24`} />
      </div>
      <div className={`${bar} h-px flex-1`} />
      <div className="flex flex-col items-end space-y-2">
        <div className={`${bar} h-5 w-14`} />
        <div className={`${bar} h-3 w-10`} />
      </div>
    </div>
  );
}

/** Placeholder with the outline of a flight card, shown while a search is running. */
export default function FlightCardSkeleton() {
  return (
    <li
      aria-hidden
      className="animate-pulse rounded-3xl border border-lavender-soft/70 bg-white p-5 motion-reduce:animate-none"
    >
      <div className="flex items-center gap-3">
        <div className="size-9 rounded-full bg-lavender-soft/70" />
        <div className="space-y-2">
          <div className={`${bar} h-4 w-32`} />
          <div className={`${bar} h-3 w-24`} />
        </div>
      </div>
      <div className="mt-6 space-y-5">
        <LegSkeleton />
        <div className="border-t border-dashed border-lavender-soft" />
        <LegSkeleton />
      </div>
      <div className="mt-6 flex items-end justify-between">
        <div className={`${bar} h-3 w-28`} />
        <div className={`${bar} h-7 w-20`} />
      </div>
      <div className={`${bar} mt-4 h-11 w-full`} />
    </li>
  );
}
