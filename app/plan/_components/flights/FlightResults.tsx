import { AlertIcon, PlaneIcon } from "@/app/components/ui/Icons";
import SortTabs from "@/app/components/ui/SortTabs";
import type { FlightOffer } from "@/app/lib/types";
import ColumnMessage from "../results/ColumnMessage";
import ResultsColumn from "../results/ResultsColumn";
import FlightCard from "./FlightCard";
import FlightCardSkeleton from "./FlightCardSkeleton";

export type FlightSort = "best" | "cheapest" | "fastest";

export type FlightSearchStatus = "idle" | "searching" | "ready" | "error";

export const FLIGHTS_PAGE_SIZE = 7;

const sortOptions: { value: FlightSort; label: string }[] = [
  { value: "best", label: "Best" },
  { value: "cheapest", label: "Cheapest" },
  { value: "fastest", label: "Fastest" },
];

const totalMinutes = (o: FlightOffer) => o.outbound.durationMinutes + (o.inbound?.durationMinutes ?? 0);

const score = (o: FlightOffer) => o.totalPrice + (totalMinutes(o) / 60) * 25;

const sortKeys: Record<FlightSort, (o: FlightOffer) => number> = {
  best: score,
  cheapest: (o) => o.totalPrice,
  fastest: totalMinutes,
};

function sortOffers(offers: FlightOffer[], sort: FlightSort) {
  const key = sortKeys[sort];
  return [...offers].sort((a, b) => key(a) - key(b));
}

function lowest(offers: FlightOffer[], key: (o: FlightOffer) => number) {
  return offers.reduce<FlightOffer | undefined>(
    (best, offer) => (!best || key(offer) < key(best) ? offer : best),
    undefined,
  );
}

type Props = {
  subtitle: string;
  offers: FlightOffer[];
  status: FlightSearchStatus;
  errorMessage?: string | null;
  filteredOut?: number;
  visibleCount: number;
  onShowMore: () => void;
  sort: FlightSort;
  onSortChange: (sort: FlightSort) => void;
  isSelected: (offer: FlightOffer) => boolean;
  selectedText: string;
  savingId: string | null;
  onSelect: (offer: FlightOffer) => void;
};

export default function FlightResults({
  subtitle,
  offers,
  status,
  errorMessage,
  filteredOut = 0,
  visibleCount,
  onShowMore,
  sort,
  onSortChange,
  isSelected,
  selectedText,
  savingId,
  onSelect,
}: Props) {
  const hasOffers = offers.length > 0;
  const shown = sortOffers(offers, sort).slice(0, visibleCount);
  const remaining = offers.length - shown.length;
  const cheapestId = lowest(offers, sortKeys.cheapest)?.id;
  const fastestId = lowest(offers, sortKeys.fastest)?.id;
  const total = offers.length.toLocaleString("en-US");

  const meta = hasOffers
    ? remaining > 0
      ? `${shown.length} of ${total}`
      : undefined
    : status === "searching"
      ? "Searching…"
      : status === "ready"
        ? undefined
        : "";

  const emptyState =
    status === "error" ? (
      <ColumnMessage tone="error" icon={<AlertIcon size={26} />} title="Couldn't load flights">
        {errorMessage ?? "Something went wrong. Please try again."}
      </ColumnMessage>
    ) : status === "ready" ? (
      filteredOut > 0 ? (
        <ColumnMessage icon={<PlaneIcon size={26} />} title="No flights match your filters">
          {filteredOut.toLocaleString("en-US")} flight{filteredOut === 1 ? " was" : "s were"} found, but none fit
          everything you asked for. Try relaxing a filter, for example “stops are fine” or “any price”.
        </ColumnMessage>
      ) : (
        <ColumnMessage icon={<PlaneIcon size={26} />} title="No flights found">
          Try different dates or a nearby airport.
        </ColumnMessage>
      )
    ) : status === "idle" ? (
      <ColumnMessage icon={<PlaneIcon size={26} />} title="Ask me to find flights">
        Tell me where and when you want to travel, for example “Copenhagen to London next Friday”.
      </ColumnMessage>
    ) : undefined;

  return (
    <ResultsColumn
      title="Flights"
      icon={<PlaneIcon size={18} />}
      count={offers.length}
      meta={meta}
      subtitle={subtitle}
      emptyState={emptyState}
      busy={status === "searching"}
      toolbar={
        hasOffers && (
          <SortTabs label="Sort flights" options={sortOptions} value={sort} onChange={onSortChange} />
        )
      }
    >
      {!hasOffers && status === "searching" && (
        <>
          <li className="sr-only" role="status">
            Searching for flights
          </li>
          <FlightCardSkeleton />
          <FlightCardSkeleton />
          <FlightCardSkeleton />
        </>
      )}

      {hasOffers && status === "error" && (
        <li role="alert" className="flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertIcon size={18} className="mt-0.5 shrink-0" />
          <span>{errorMessage} These are the flights from your previous search.</span>
        </li>
      )}

      {shown.map((offer) => (
        <FlightCard
          key={offer.id}
          offer={offer}
          tags={[offer.id === cheapestId && "Cheapest", offer.id === fastestId && "Fastest"].filter(
            (t): t is string => Boolean(t),
          )}
          selected={isSelected(offer)}
          selectedText={selectedText}
          busy={offer.id === savingId}
          onSelect={() => onSelect(offer)}
        />
      ))}

      {remaining > 0 && (
        <li>
          <button
            type="button"
            onClick={onShowMore}
            className="w-full rounded-full border border-lavender-soft bg-white py-3 text-[0.9375rem] font-semibold text-ink transition-colors hover:border-lavender hover:bg-lavender-soft/40"
          >
            Show {Math.min(FLIGHTS_PAGE_SIZE, remaining)} more
            {remaining > FLIGHTS_PAGE_SIZE && (
              <span className="ml-1.5 font-normal text-ink-muted">
                ({remaining.toLocaleString("en-US")} left)
              </span>
            )}
          </button>
        </li>
      )}
    </ResultsColumn>
  );
}
