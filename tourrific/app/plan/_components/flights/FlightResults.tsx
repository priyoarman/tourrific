import { PlaneIcon } from "@/app/components/ui/Icons";
import SortTabs from "@/app/components/ui/SortTabs";
import { formatDate } from "@/app/lib/format";
import type { FlightOffer, Trip } from "@/app/lib/types";
import ResultsColumn from "../results/ResultsColumn";
import FlightCard from "./FlightCard";

export type FlightSort = "best" | "cheapest" | "fastest";

const sortOptions: { value: FlightSort; label: string }[] = [
  { value: "best", label: "Best" },
  { value: "cheapest", label: "Cheapest" },
  { value: "fastest", label: "Fastest" },
];

const totalMinutes = (o: FlightOffer) => o.outbound.durationMinutes + o.inbound.durationMinutes;

// "Best" balances price against time: each hour in the air costs about $25.
const score = (o: FlightOffer) => o.totalPrice + (totalMinutes(o) / 60) * 25;

function sortOffers(offers: FlightOffer[], sort: FlightSort) {
  const key = { best: score, cheapest: (o: FlightOffer) => o.totalPrice, fastest: totalMinutes }[sort];
  return [...offers].sort((a, b) => key(a) - key(b));
}

type Props = {
  trip: Trip;
  offers: FlightOffer[];
  sort: FlightSort;
  onSortChange: (sort: FlightSort) => void;
  selectedId: string | null;
  onSelect: (offer: FlightOffer) => void;
};

export default function FlightResults({ trip, offers, sort, onSortChange, selectedId, onSelect }: Props) {
  const cheapestId = sortOffers(offers, "cheapest")[0]?.id;
  const fastestId = sortOffers(offers, "fastest")[0]?.id;

  return (
    <ResultsColumn
      title="Flights"
      icon={<PlaneIcon size={18} />}
      count={offers.length}
      subtitle={`${trip.origin.city} → ${trip.destination.city} · ${formatDate(trip.departDate)} – ${formatDate(trip.returnDate)} · ${trip.travelers} adult`}
      toolbar={<SortTabs label="Sort flights" options={sortOptions} value={sort} onChange={onSortChange} />}
    >
      {sortOffers(offers, sort).map((offer) => (
        <FlightCard
          key={offer.id}
          offer={offer}
          tags={[offer.id === cheapestId && "Cheapest", offer.id === fastestId && "Fastest"].filter(
            (t): t is string => Boolean(t),
          )}
          selected={offer.id === selectedId}
          onSelect={() => onSelect(offer)}
        />
      ))}
    </ResultsColumn>
  );
}
