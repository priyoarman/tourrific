import { toFlightOffer } from "./duffel-to-flight-offer";
import { consumeSseStream } from "./sse";
import type { FlightOffer } from "./types";
import type {
  SearchContext,
  SearchLimitReason,
  SearchStreamRequest,
  StreamComplete,
  StreamEventHandlers,
} from "./types/stream-events";
import type { TripQuery } from "./types/trip-query";

export class SearchRejected extends Error {
  status: number;
  reason: SearchLimitReason | null;

  constructor(status: number, data: unknown) {
    const body = (data && typeof data === "object" ? data : {}) as { message?: unknown; reason?: unknown };
    super(typeof body.message === "string" ? body.message : "");
    this.name = "SearchRejected";
    this.status = status;
    this.reason = typeof body.reason === "string" ? (body.reason as SearchLimitReason) : null;
  }
}

export async function searchFlights(
  prompt: string,
  context: SearchContext,
  handlers: StreamEventHandlers,
  signal?: AbortSignal,
) {
  const hasContext = Boolean(context.destination || context.tripQuery);
  const body: SearchStreamRequest = {
    prompt: prompt.trim(),
    limit: "all",
    context: hasContext ? context : undefined,
  };

  const response = await fetch("/api/flights/search-stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) throw new SearchRejected(response.status, await response.json().catch(() => null));

  await consumeSseStream(response, handlers);
}

type Place = { city: string; airport: string };

export type FlightSearchResult = {
  offers: FlightOffer[];
  query: TripQuery;
  filters: string[];
  unfilteredCount: number;
  origin: Place;
  destination: Place & { countryCode: string | null };
};

export function toSearchResult(event: StreamComplete): FlightSearchResult {
  const { extracted, offers } = event;
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
