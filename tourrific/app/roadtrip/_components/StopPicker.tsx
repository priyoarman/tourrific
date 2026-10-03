import { CheckIcon } from "@/app/components/ui/Icons";
import type { RoadTripStop } from "@/app/lib/types";

type Props = {
  stops: RoadTripStop[];
  activeId: string;
  bookedIds: string[];
  onChange: (stopId: string) => void;
};

/** Switches which stop the hotels column is showing places to stay for. */
export default function StopPicker({ stops, activeId, bookedIds, onChange }: Props) {
  return (
    <div role="group" aria-label="Choose a stop" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
      {stops.map((stop, i) => {
        const active = stop.id === activeId;
        const booked = bookedIds.includes(stop.id);
        return (
          <button
            key={stop.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(stop.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-2xl border py-1.5 pr-3 pl-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
              active
                ? "border-lavender bg-lavender-soft/60 text-ink"
                : "border-lavender-soft bg-white text-ink hover:border-lavender"
            }`}
          >
            <span
              className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${
                booked ? "bg-emerald-600 text-white" : "bg-ink text-white"
              }`}
            >
              {booked ? <CheckIcon size={13} /> : i + 1}
            </span>
            {stop.city.split(",")[0]}
          </button>
        );
      })}
    </div>
  );
}
