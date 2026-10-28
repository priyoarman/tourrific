import type { ReactNode } from "react";
import Logo from "@/app/components/ui/Logo";
import { cardClass } from "../_components/SectionCard";

const bar = "rounded-full bg-lavender-soft/70";
const block = "rounded-2xl bg-lavender-soft/50";

/** A dashboard card's outline: the icon-and-title heading row, then whatever the card holds. */
function CardSkeleton({ children }: { children: ReactNode }) {
  return (
    <div className={`${cardClass} p-5`}>
      <div className="flex items-center gap-3">
        <div className="size-9 shrink-0 rounded-full bg-lavender-soft/70" />
        <div className={`${bar} h-5 w-36`} />
      </div>
      {children}
    </div>
  );
}

function FlightLegSkeleton() {
  return (
    <div className="mt-4 grid grid-cols-[auto_1fr_auto] items-center gap-5">
      <div className="space-y-1.5">
        <div className={`${bar} h-6 w-14`} />
        <div className={`${bar} h-3 w-10`} />
      </div>
      <div className="h-px bg-lavender-soft" />
      <div className="space-y-1.5">
        <div className={`${bar} h-6 w-14`} />
        <div className={`${bar} ml-auto h-3 w-10`} />
      </div>
    </div>
  );
}

/**
 * What /itinerary/[id] shows while it loads: the outline of every card, in the
 * same columns as the page, so nothing jumps when the trip arrives.
 */
export default function ItineraryLoading() {
  return (
    <div
      role="status"
      className="mx-auto flex w-full max-w-400 flex-1 flex-col gap-5 px-5 pt-6 pb-5 sm:px-7 sm:zoom-[0.9]"
    >
      <span className="sr-only">Loading your itinerary…</span>

      <div aria-hidden className="flex flex-col gap-5">
        <header className="grid grid-cols-[auto_1fr] items-center gap-4 lg:grid-cols-[1fr_auto_1fr]">
          <Logo className="text-2xl sm:text-3xl" />
          <div className={`${bar} order-last col-span-2 h-9 w-full lg:order-none lg:col-span-1 lg:w-96`} />
          <div className="flex items-center justify-end gap-5">
            <div className={`${bar} h-4 w-20`} />
          </div>
        </header>

        <div className="grid animate-pulse gap-5 motion-reduce:animate-none lg:grid-cols-2 xl:grid-cols-3">
          <div className="flex flex-col gap-5">
            {/* Save trip and Send by email. */}
            <div className="flex gap-3">
              <div className={`${bar} h-13 flex-1`} />
              <div className={`${bar} h-13 flex-1`} />
            </div>

            {/* Trip overview: the photo, the title, then three facts. */}
            <div className={`${cardClass} p-5`}>
              <div className={`${block} h-48`} />
              <div className={`${bar} mt-4 h-6 w-48`} />
              <div className={`${bar} mt-2 h-3 w-full`} />
              <div className={`${bar} mt-1.5 h-3 w-2/3`} />
              <div className="mt-4 grid grid-cols-3 gap-3 border-t border-lavender-soft/70 pt-3.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="space-y-1.5">
                    <div className={`${bar} h-3 w-12`} />
                    <div className={`${bar} h-4 w-16`} />
                  </div>
                ))}
              </div>
            </div>

            {/* Budget: the split bar, then flights and hotel. */}
            <CardSkeleton>
              <div className={`${bar} mt-4 h-2.5 w-full`} />
              <div className="mt-4 space-y-3">
                {[0, 1].map((i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className={`${bar} h-3 w-24`} />
                    <div className={`${bar} h-3 w-14`} />
                  </div>
                ))}
              </div>
            </CardSkeleton>
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            <CardSkeleton>
              <FlightLegSkeleton />
              <div className="mt-4 border-t border-dashed border-lavender-soft" />
              <FlightLegSkeleton />
            </CardSkeleton>

            {/* Hotel: the photo and name, then check-in and check-out. */}
            <CardSkeleton>
              <div className="mt-4 flex items-center gap-3">
                <div className="size-11 shrink-0 rounded-xl bg-lavender-soft/50" />
                <div className="space-y-1.5">
                  <div className={`${bar} h-4 w-40`} />
                  <div className={`${bar} h-3 w-24`} />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className={`${block} h-14`} />
                <div className={`${block} h-14`} />
              </div>
            </CardSkeleton>
          </div>

          <div className="flex min-w-0 flex-col gap-5 lg:col-span-2 xl:col-span-1">
            {/* Calendar: a month of days. */}
            <CardSkeleton>
              <div className="mt-4 grid grid-cols-7 gap-2">
                {Array.from({ length: 35 }, (_, i) => (
                  <div key={i} className="mx-auto size-6 rounded-full bg-lavender-soft/50" />
                ))}
              </div>
            </CardSkeleton>
          </div>
        </div>
      </div>
    </div>
  );
}
