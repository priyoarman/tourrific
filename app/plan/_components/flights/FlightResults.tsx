import { AlertIcon, PlaneIcon } from "@/app/components/ui/Icons";
import SortTabs from "@/app/components/ui/SortTabs";
import type { FlightOffer } from "@/app/lib/types";
import ColumnMessage from "../results/ColumnMessage";
import ResultsColumn from "../results/ResultsColumn";
import FlightCard from "./FlightCard";
import FlightCardSkeleton from "./FlightCardSkeleton";

export type FlightSort = "best" | "cheapest" | "fastest";

/** Where the search stands: nothing asked yet, running, finished, or failed. */
export type FlightSearchStatus = "idle" | "searching" | "ready" | "error";

/** How many cards are shown at first, and how many "Show more" adds. */
export const FLIGHTS_PAGE_SIZE = 7;

const sortOptions: { value: FlightSort; label: string }[] = [
  { value: "best", label: "Best" },
  { value: "cheapest", label: "Cheapest" },
  { value: "fastest", label: "Fastest" },
];

const totalMinutes = (o: FlightOffer) => o.outbound.durationMinutes + (o.inbound?.durationMinutes ?? 0);

// "Best" balances price against time: each hour of travel counts like 25 of the fare's currency.
const score = (o: FlightOffer) => o.totalPrice + (totalMinutes(o) / 60) * 25;

const sortKeys: Record<FlightSort, (o: FlightOffer) => number> = {
  best: score,
  cheapest: (o) => o.totalPrice,
  fastest: totalMinutes,
};

function sortOffers(offers: FlightOffer[], sort: FlightSort) {
  const key = sortKeys[sort];
  // Array.sort is stable, so ties keep Duffel's order.
  return [...offers].sort((a, b) => key(a) - key(b));
}

function lowest(offers: FlightOffer[], key: (o: FlightOffer) => number) {
  return offers.reduce<FlightOffer | undefined>(
    (best, offer) => (!best || key(offer) < key(best) ? offer : best),
    undefined,
  );
}

type Props = {
  /** One line describing the search, e.g. "Copenhagen → London · Thu 12 Nov · 1 adult". */
  subtitle: string;
  /** Every offer of the current search; this component sorts and pages them. */
  offers: FlightOffer[];
  status: FlightSearchStatus;
  /** What went wrong, when `status` is "error". */
  errorMessage?: string | null;
  /** How many flights the search found but the visitor's filters removed. */
  filteredOut?: number;
  visibleCount: number;
  onShowMore: () => void;
  sort: FlightSort;
  onSortChange: (sort: FlightSort) => void;
  /** Whether an offer is in the visitor's saved trips. */
  isSaved: (offer: FlightOffer) => boolean;
  /** The offer being saved or removed right now, if any. */
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
  isSaved,
  savingId,
  onSelect,
}: Props) {
  const hasOffers = offers.length > 0;
  const shown = sortOffers(offers, sort).slice(0, visibleCount);
  const remaining = offers.length - shown.length;
  const cheapestId = lowest(offers, sortKeys.cheapest)?.id;
  const fastestId = lowest(offers, sortKeys.fastest)?.id;
  const total = offers.length.toLocaleString("en-US");

  // The note beside the title. A count only makes sense once a search has finished.
  const meta = hasOffers
    ? remaining > 0
      ? `${shown.length} of ${total}`
      : undefined
    : status === "searching"
      ? "Searching…"
      : status === "ready"
        ? undefined
        : "";

  // With nothing to list, say why. While searching, skeleton cards take the list's place instead.
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
          selected={isSaved(offer)}
          busy={offer.id === savingId}
          onSelect={() => onSelect(offer)}
        />
      ))}

      {remaining > 0 && (
        <li>
          <button
            type="button"
            onClick={onShowMore}
            className="w-full rounded-full border border-lavender-soft bg-white py-3 text-[15px] font-semibold text-ink transition-colors hover:border-lavender hover:bg-lavender-soft/40"
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
