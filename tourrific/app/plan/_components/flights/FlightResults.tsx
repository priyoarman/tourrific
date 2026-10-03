import type { ReactNode } from "react";
import { PlaneIcon } from "@/app/components/ui/Icons";
import SortTabs from "@/app/components/ui/SortTabs";
import type { FlightOffer } from "@/app/lib/types";
import ResultsColumn from "../results/ResultsColumn";
import FlightCard from "./FlightCard";

export type FlightSort = "best" | "cheapest" | "fastest";

const sortOptions: { value: FlightSort; label: string }[] = [
  { value: "best", label: "Best" },
  { value: "cheapest", label: "Cheapest" },
  { value: "fastest", label: "Fastest" },
];

const totalMinutes = (o: FlightOffer) => o.outbound.durationMinutes + (o.inbound?.durationMinutes ?? 0);

// "Best" balances price against time: each hour of travel counts like 25 of the fare's currency.
const score = (o: FlightOffer) => o.totalPrice + (totalMinutes(o) / 60) * 25;

function sortOffers(offers: FlightOffer[], sort: FlightSort) {
  const key = { best: score, cheapest: (o: FlightOffer) => o.totalPrice, fastest: totalMinutes }[sort];
  return [...offers].sort((a, b) => key(a) - key(b));
}

type Props = {
  /** One line describing the search, e.g. "Copenhagen → London · Thu 12 Nov · 1 adult". */
  subtitle: string;
  offers: FlightOffer[];
  /** All offers the search found; `offers` may be only the first page of them. */
  totalOffers: number;
  /** Shown when there are no offers: a prompt to search, a loading note, or "no flights". */
  emptyState: ReactNode;
  sort: FlightSort;
  onSortChange: (sort: FlightSort) => void;
  selectedId: string | null;
  onSelect: (offer: FlightOffer) => void;
};

export default function FlightResults({ subtitle, offers, totalOffers, emptyState, sort, onSortChange, selectedId, onSelect }: Props) {
  const cheapestId = sortOffers(offers, "cheapest")[0]?.id;
  const fastestId = sortOffers(offers, "fastest")[0]?.id;
  const meta =
    totalOffers > offers.length
      ? `${offers.length} of ${totalOffers.toLocaleString("en-US")}`
      : undefined;

  return (
    <ResultsColumn
      title="Flights"
      icon={<PlaneIcon size={18} />}
      count={offers.length}
      meta={meta}
      subtitle={subtitle}
      emptyState={emptyState}
      toolbar={
        offers.length > 0 && (
          <SortTabs label="Sort flights" options={sortOptions} value={sort} onChange={onSortChange} />
        )
      }
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
