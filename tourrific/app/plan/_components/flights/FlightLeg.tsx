import { PlaneIcon } from "@/app/components/ui/Icons";
import { dayOffset, formatDate, formatDuration, formatTime } from "@/app/lib/format";
import type { FlightSlice } from "@/app/lib/types";

/** One direction of a trip: times and airports on each side, route line in between. */
export default function FlightLeg({ slice }: { slice: FlightSlice }) {
  const offset = dayOffset(slice.departureTime, slice.arrivalTime);
  const stop = slice.stops[0];

  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
      <div>
        <p className="text-xl font-semibold text-ink tabular-nums">{formatTime(slice.departureTime)}</p>
        <p className="text-sm text-ink-muted">
          {slice.origin} · {formatDate(slice.departureTime)}
        </p>
      </div>

      <div className="flex flex-col items-center gap-1 text-xs text-ink-muted">
        <span>{formatDuration(slice.durationMinutes)}</span>
        <div className="relative flex w-full items-center">
          <span className="h-px flex-1 bg-lavender-soft" />
          {stop && <span className="mx-1 size-1.5 rounded-full bg-ink-subtle" />}
          {stop && <span className="h-px flex-1 bg-lavender-soft" />}
          <PlaneIcon size={14} className="ml-1 rotate-90 text-lavender" />
        </div>
        <span className={stop ? "text-ink-muted" : "font-medium text-emerald-700"}>
          {stop ? `1 stop · ${stop.airport}` : "Direct"}
        </span>
      </div>

      <div className="text-right">
        <p className="text-xl font-semibold text-ink tabular-nums">
          {formatTime(slice.arrivalTime)}
          {offset > 0 && (
            <sup className="ml-0.5 text-xs font-medium text-ink-muted" aria-label={`plus ${offset} day`}>
              +{offset}
            </sup>
          )}
        </p>
        <p className="text-sm text-ink-muted">{slice.destination}</p>
      </div>
    </div>
  );
}
