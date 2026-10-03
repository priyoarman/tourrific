import type { ReactNode } from "react";
import { BedIcon } from "@/app/components/ui/Icons";
import SortTabs from "@/app/components/ui/SortTabs";
import { formatDate, formatNights } from "@/app/lib/format";
import type { Hotel, Trip } from "@/app/lib/types";
import ResultsColumn from "../results/ResultsColumn";
import HotelCard from "./HotelCard";

export type HotelSort = "recommended" | "price" | "rating";

const sortOptions: { value: HotelSort; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "price", label: "Lowest price" },
  { value: "rating", label: "Top rated" },
];

function sortHotels(hotels: Hotel[], sort: HotelSort) {
  if (sort === "recommended") return hotels;
  return [...hotels].sort((a, b) =>
    sort === "price" ? a.nightlyPrice - b.nightlyPrice : b.rating - a.rating,
  );
}

type Props = {
  trip: Trip;
  hotels: Hotel[];
  sort: HotelSort;
  onSortChange: (sort: HotelSort) => void;
  selectedId: string | null;
  onSelect: (hotel: Hotel) => void;
  /** Rendered above the sort options, e.g. a stop picker on the road trip page. */
  toolbarExtra?: ReactNode;
};

export default function HotelResults({ trip, hotels, sort, onSortChange, selectedId, onSelect, toolbarExtra }: Props) {
  return (
    <ResultsColumn
      title="Hotels"
      icon={<BedIcon size={18} />}
      count={hotels.length}
      subtitle={`${trip.destination.city} · ${formatDate(trip.departDate)} – ${formatDate(trip.returnDate)} · ${formatNights(trip.nights)}`}
      toolbar={
        <>
          {toolbarExtra}
          <SortTabs label="Sort hotels" options={sortOptions} value={sort} onChange={onSortChange} />
        </>
      }
    >
      {sortHotels(hotels, sort).map((hotel) => (
        <HotelCard
          key={hotel.id}
          hotel={hotel}
          nights={trip.nights}
          selected={hotel.id === selectedId}
          onSelect={() => onSelect(hotel)}
        />
      ))}
    </ResultsColumn>
  );
}
