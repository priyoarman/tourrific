import { CarIcon, RouteIcon } from "@/app/components/ui/Icons";
import { formatDate, formatDuration } from "@/app/lib/format";
import type { Hotel, RoadTrip } from "@/app/lib/types";
import ColumnHeader from "@/app/plan/_components/results/ColumnHeader";
import RouteMap from "./RouteMap";
import StopCard from "./StopCard";

type Props = {
  trip: RoadTrip;
  activeStopId: string;
  hotels: Record<string, Hotel>;
  onSelectStop: (stopId: string) => void;
  onChooseHotel: (stopId: string) => void;
};

/** Middle column of the road trip planner: the route map and the stop-by-stop itinerary. */
export default function RouteColumn({ trip, activeStopId, hotels, onSelectStop, onChooseHotel }: Props) {
  const first = trip.stops[0];
  const last = trip.stops[trip.stops.length - 1];

  return (
    <section aria-label="Route" className="flex h-full min-h-0 flex-col">
      <ColumnHeader
        title="Route"
        icon={<RouteIcon size={18} />}
        meta={`${trip.stops.length} stops`}
        subtitle={`${first.city} → ${last.city} · ${formatDate(trip.startDate)} – ${formatDate(trip.endDate)} · ${trip.nights} nights`}
        toolbar={
          <div className="flex flex-wrap gap-2 text-sm font-medium text-ink">
            <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 ring-1 ring-lavender-soft">
              <CarIcon size={15} />
              {trip.totalKm.toLocaleString("en-US")} km
            </span>
            <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-lavender-soft">
              {formatDuration(trip.totalDriveMinutes)} driving
            </span>
            <span className="rounded-full bg-white px-3 py-1.5 ring-1 ring-lavender-soft">One-way</span>
          </div>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-1 pb-6">
        <RouteMap stops={trip.stops} activeId={activeStopId} onSelect={onSelectStop} />

        <h3 className="mt-6 mb-3 text-sm font-semibold tracking-wide text-ink-subtle uppercase">
          {trip.route.title} · {trip.route.region}
        </h3>
        <ol aria-label="Itinerary">
          {trip.stops.map((stop, i) => (
            <StopCard
              key={stop.id}
              stop={stop}
              index={i}
              isLast={i === trip.stops.length - 1}
              previousCity={trip.stops[i - 1]?.city ?? null}
              hotel={hotels[stop.id]}
              active={stop.id === activeStopId}
              onSelect={() => onSelectStop(stop.id)}
              onChooseHotel={() => onChooseHotel(stop.id)}
            />
          ))}
        </ol>
      </div>
    </section>
  );
}
