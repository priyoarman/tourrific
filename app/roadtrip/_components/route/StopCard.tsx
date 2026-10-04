import { BedIcon, CarIcon, CheckIcon } from "@/app/components/ui/Icons";
import { formatDate, formatDuration, formatNights, formatPrice } from "@/app/lib/format";
import type { Hotel, RoadTripStop } from "@/app/lib/types";

type Props = {
  stop: RoadTripStop;
  index: number;
  isLast: boolean;
  previousCity: string | null;
  hotel: Hotel | undefined;
  active: boolean;
  onSelect: () => void;
  onChooseHotel: () => void;
};

/** One stop on the itinerary timeline, with the drive that leads to it. */
export default function StopCard({ stop, index, isLast, previousCity, hotel, active, onSelect, onChooseHotel }: Props) {
  return (
    <li className="relative grid grid-cols-[2rem_1fr] gap-3">
      {/* Timeline rail linking each stop to the next. */}
      <div className="flex flex-col items-center">
        <span
          className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
            active ? "bg-lavender text-ink" : "bg-ink text-white"
          }`}
        >
          {index + 1}
        </span>
        {!isLast && <span aria-hidden className="mt-1 w-px flex-1 border-l-2 border-dashed border-lavender-soft" />}
      </div>

      <div className="pb-4">
        {stop.leg && previousCity && (
          <p className="mb-2 flex items-center gap-1.5 text-xs text-ink-muted">
            <CarIcon size={14} />
            {formatDuration(stop.leg.minutes)} drive · {stop.leg.km} km from {previousCity}
          </p>
        )}

        <article
          className={`rounded-3xl border bg-white p-4 shadow-[0_10px_30px_-18px_rgba(42,27,61,0.35)] transition-colors ${
            active ? "border-lavender ring-2 ring-lavender/40" : "border-lavender-soft/70"
          }`}
        >
          <button type="button" onClick={onSelect} aria-pressed={active} className="block w-full text-left">
            <h3 className="text-lg font-semibold text-ink">
              {stop.city} <span aria-hidden>{stop.flag}</span>
            </h3>
            <p className="text-sm text-ink-muted">
              {formatDate(stop.arriveDate)} – {formatDate(stop.leaveDate)} · {formatNights(stop.nights)}
              {index === 0 && " · Start"}
              {isLast && " · Finish"}
            </p>
          </button>

          <ul className="mt-3 flex flex-wrap gap-1.5">
            {stop.highlights.map((highlight) => (
              <li key={highlight} className="rounded-full bg-lavender-soft/50 px-2.5 py-1 text-xs font-medium text-ink">
                {highlight}
              </li>
            ))}
          </ul>

          <div className="mt-3 border-t border-dashed border-lavender-soft pt-3">
            {hotel ? (
              <button
                type="button"
                onClick={onChooseHotel}
                className="flex w-full items-center justify-between gap-2 text-left text-sm"
              >
                <span className="flex min-w-0 items-center gap-1.5 font-medium text-ink">
                  <CheckIcon size={15} className="shrink-0 text-emerald-700" />
                  <span className="truncate">{hotel.name}</span>
                </span>
                <span className="shrink-0 text-ink-muted">{formatPrice(hotel.nightlyPrice * stop.nights)}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onChooseHotel}
                className="flex items-center gap-1.5 rounded-full text-sm font-semibold text-ink transition-colors hover:text-lavender-hover"
              >
                <BedIcon size={16} />
                Choose a place to stay
              </button>
            )}
          </div>
        </article>
      </div>
    </li>
  );
}
