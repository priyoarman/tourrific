import { toFlightOffer } from "./duffel-to-flight-offer";
import { consumeSseStream } from "./sse";
import type { FlightOffer } from "./types";
import type {
  SearchContext,
  SearchStreamRequest,
  StreamComplete,
  StreamEventHandlers,
} from "./types/stream-events";
import type { TripQuery } from "./types/trip-query";

/**
 * Sends one chat message to the backend, which extracts a flight search from it
 * and streams back progress, replies and results. Each handler is called as its
 * event arrives; the promise resolves when the stream ends.
 *
 * `context` is what earlier searches returned. Passing it back lets follow-ups
 * like "a little later" build on the previous search.
 */
export async function searchFlights(
  prompt: string,
  context: SearchContext,
  handlers: StreamEventHandlers,
  signal?: AbortSignal,
) {
  const hasContext = Boolean(context.destination || context.tripQuery);
  const body: SearchStreamRequest = {
    prompt: prompt.trim(),
    // Every offer in one go, so sorting and "Show more" never re-run the search.
    limit: "all",
    context: hasContext ? context : undefined,
  };

  const response = await fetch("/api/flights/search-stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  await consumeSseStream(response, handlers);
}

type Place = { city: string; airport: string };

/** A finished search, ready for the results columns. */
export type FlightSearchResult = {
  /** Every offer the search found, in the order Duffel returned them (cheapest first). */
  offers: FlightOffer[];
  query: TripQuery;
  /** One short label per filter the search applied, e.g. "Direct", "Under €134". */
  filters: string[];
  /** How many flights the search found before those filters. */
  unfilteredCount: number;
  origin: Place;
  destination: Place & { countryCode: string | null };
};

export function toSearchResult(event: StreamComplete): FlightSearchResult {
  const { extracted, offers } = event;
  // City names only come with offers; with no results, fall back to airport codes.
  const firstSlice = offers[0]?.slices[0];
  const originCode = firstSlice?.origin.iata_code ?? extracted.origin_airport ?? "";
  const destinationCode = firstSlice?.destination.iata_code ?? event.destination;

  return {
    offers: offers.map(toFlightOffer),
    query: extracted,
    filters: event.filters?.labels ?? [],
    unfilteredCount: event.filters?.unfilteredCount ?? offers.length,
    origin: { city: firstSlice?.origin.city_name ?? originCode, airport: originCode },
    destination: {
      city: firstSlice?.destination.city_name ?? destinationCode,
      airport: destinationCode,
      countryCode: firstSlice?.destination.iata_country_code ?? null,
    },
  };
}
