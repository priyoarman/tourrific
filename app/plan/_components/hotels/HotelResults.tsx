import type { ReactNode } from "react";
import { AlertIcon, BedIcon } from "@/app/components/ui/Icons";
import SortTabs from "@/app/components/ui/SortTabs";
import { formatDate, formatNights } from "@/app/lib/format";
import type { Hotel } from "@/app/lib/types";
import ColumnMessage from "../results/ColumnMessage";
import ResultsColumn from "../results/ResultsColumn";
import SampleBadge from "../results/SampleBadge";
import HotelCard from "./HotelCard";
import HotelCardSkeleton from "./HotelCardSkeleton";

export type HotelSort = "recommended" | "price" | "rating";

export type HotelSearchStatus = "idle" | "searching" | "ready" | "error" | "no-stay";

const sortOptions: { value: HotelSort; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "price", label: "Lowest price" },
  { value: "rating", label: "Top rated" },
];

function sortHotels(hotels: Hotel[], sort: HotelSort) {
  if (sort === "recommended") return hotels;
  return [...hotels].sort((a, b) =>
    sort === "price" ? a.nightlyPrice - b.nightlyPrice : (b.rating ?? 0) - (a.rating ?? 0),
  );
}

export function staySummary(city: string, checkIn: string, checkOut: string, nights: number, filters: string[] = []) {
  return [city, `${formatDate(checkIn)} – ${formatDate(checkOut)}`, formatNights(nights), ...filters].join(" · ");
}

export function oneWayStaySummary(city: string, checkIn: string, filters: string[] = []) {
  return [city, `From ${formatDate(checkIn)}`, "Per night", ...filters].join(" · ");
}

type Props = {
  subtitle: string;
  hotels: Hotel[];
  nights: number;
  oneWay?: boolean;
  status?: HotelSearchStatus;
  total?: number;
  filteredOut?: number;
  sort: HotelSort;
  onSortChange: (sort: HotelSort) => void;
  selectedId: string | null;
  onSelect: (hotel: Hotel) => void;
  toolbarExtra?: ReactNode;
  sample?: boolean;
};

export default function HotelResults({
  subtitle,
  hotels,
  nights,
  oneWay = false,
  status = "ready",
  total,
  filteredOut = 0,
  sort,
  onSortChange,
  selectedId,
  onSelect,
  toolbarExtra,
  sample = false,
}: Props) {
  const hasHotels = hotels.length > 0;

  const meta = hasHotels
    ? total && total > hotels.length
      ? `${hotels.length} of ${total.toLocaleString("en-US")}`
      : undefined
    : status === "searching"
      ? "Searching…"
      : status === "ready"
        ? undefined
        : "";

  const emptyState =
    status === "error" ? (
      <ColumnMessage tone="error" icon={<AlertIcon size={26} />} title="Couldn't load hotels">
        The hotel search didn&apos;t answer. Your flights are not affected; try the search again in a moment.
      </ColumnMessage>
    ) : status === "ready" ? (
      filteredOut > 0 ? (
        <ColumnMessage icon={<BedIcon size={26} />} title="No hotels match your wishes">
          {filteredOut.toLocaleString("en-US")} hotel{filteredOut === 1 ? " was" : "s were"} found, but none fit
          everything you asked for. Try relaxing one, for example “any hotel price” or “no pool needed”.
        </ColumnMessage>
      ) : (
        <ColumnMessage icon={<BedIcon size={26} />} title="No hotels found">
          Nothing is available for those dates. Try different ones.
        </ColumnMessage>
      )
    ) : status === "no-stay" ? (
      <ColumnMessage icon={<BedIcon size={26} />} title="No stay to search">
        Hotels are listed for trips with at least one night away.
      </ColumnMessage>
    ) : status === "idle" ? (
      <ColumnMessage icon={<BedIcon size={26} />} title="Hotels follow your flights">
        Places to stay appear here once you&apos;ve searched for a trip.
      </ColumnMessage>
    ) : undefined;

  return (
    <ResultsColumn
      title="Hotels"
      icon={<BedIcon size={18} />}
      count={hotels.length}
      meta={meta}
      badge={sample ? <SampleBadge /> : undefined}
      subtitle={subtitle}
      emptyState={emptyState}
      busy={status === "searching"}
      toolbar={
        (toolbarExtra || hasHotels) && (
          <>
            {toolbarExtra}
            {hasHotels && <SortTabs label="Sort hotels" options={sortOptions} value={sort} onChange={onSortChange} />}
          </>
        )
      }
    >
      {!hasHotels && status === "searching" && (
        <>
          <li className="sr-only" role="status">
            Searching for hotels
          </li>
          <HotelCardSkeleton />
          <HotelCardSkeleton />
        </>
      )}

      {sortHotels(hotels, sort).map((hotel) => (
        <HotelCard
          key={hotel.id}
          hotel={hotel}
          nights={nights}
          oneWay={oneWay}
          selected={hotel.id === selectedId}
          onSelect={() => onSelect(hotel)}
        />
      ))}
    </ResultsColumn>
  );
}
