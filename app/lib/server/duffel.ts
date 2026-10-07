// Searches flights with the Duffel API. Ported from api/src/services/duffel.js.
import type { DuffelOffer } from "../types/duffel";
import { createTtlCache } from "./ttl-cache.ts";

const DEFAULT_API_URL = "https://api.duffel.com";
// A search across many airlines can take Duffel several seconds; this is well past a normal one.
const DEFAULT_TIMEOUT_MS = 20_000;

/** Duffel didn't answer in time. */
export class DuffelTimeout extends Error {
  constructor() {
    super("Duffel took too long to answer.");
    this.name = "DuffelTimeout";
  }
}

export type DuffelSearchSlice = {
  origin?: string;
  destination?: string;
  /** YYYY-MM-DD */
  departure_date: string | null;
  /** Only flights leaving in this window of the day, as "HH:MM". `from` must be before `to`. */
  departure_time?: { from: string; to: string };
};

export type DuffelSearchPayload = {
  slices: DuffelSearchSlice[];
  passengers: { type: string }[];
  cabin_class: string;
  /** Most stops allowed per direction. Duffel's default is 1; 0 means direct only. */
  max_connections?: number;
  [extra: string]: unknown;
};

/** Duffel's answer to an offer request. Only the offers are used. */
export type DuffelSearchResponse = { data?: { offers?: DuffelOffer[] } };

/**
 * Posts `payload` to a Duffel endpoint such as "/air/offer_requests" and returns the answer as text.
 * Throws DuffelTimeout when Duffel takes too long, and an Error with Duffel's answer when it refuses.
 */
export async function postToDuffel(path: string, payload: unknown, signal?: AbortSignal) {
  // Read per call, so a changed .env.local is picked up without a restart.
  const baseUrl = process.env.DUFFEL_API_URL || DEFAULT_API_URL;
  const token = process.env.DUFFEL_ACCESS_TOKEN || process.env.DUFFEL_TOKEN;
  if (!token) throw new Error("Missing Duffel access token in DUFFEL_ACCESS_TOKEN (or DUFFEL_TOKEN).");

  const timeout = AbortSignal.timeout(Number(process.env.DUFFEL_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Duffel-Version": "v2",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: payload }),
      cache: "no-store",
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });

    const text = await response.text();
    if (!response.ok) throw new Error(text);
    return text;
  } catch (error) {
    // The visitor leaving is not a timeout, even if both happen at once.
    throw timeout.aborted && !signal?.aborted ? new DuffelTimeout() : error;
  }
}

/** With DUFFEL_USE_MOCK=true, a failed search answers with the sample offers in data/mock-flights.json. */
async function orSampleOffers(search: () => Promise<DuffelSearchResponse>, signal?: AbortSignal) {
  try {
    return await search();
  } catch (error) {
    // Nobody is waiting for the answer any more, sample or not.
    if (signal?.aborted) throw error;

    if (process.env.DUFFEL_USE_MOCK?.toLowerCase() === "true") {
      console.warn(
        "Duffel request failed; falling back to mock data:",
        error instanceof Error ? error.message : error,
      );
      const mock = await import("./data/mock-flights.json", { with: { type: "json" } });
      return mock.default as unknown as DuffelSearchResponse;
    }
    throw error;
  }
}

/**
 * Asks Duffel for offers. With DUFFEL_USE_MOCK=true, a failed request returns
 * the sample offers in data/mock-flights.json instead of throwing.
 *
 * Throws DuffelTimeout when Duffel takes too long. Aborting `signal` (the
 * visitor is no longer waiting) drops the request and throws an AbortError.
 */
export function searchFlights(payload: DuffelSearchPayload, signal?: AbortSignal): Promise<DuffelSearchResponse> {
  return orSampleOffers(async () => JSON.parse(await postToDuffel("/air/offer_requests", payload, signal)), signal);
}

// Prices move, but not within minutes, and nothing is booked from these offers.
const DEFAULT_CACHE_MINUTES = 10;

// Answers are kept as the text Duffel sent: one search is a few megabytes, and
// text has a known size where parsed objects don't. 40 million characters is
// at most 80 MB, on a server with 512.
const cache = createTtlCache({ maxEntries: 50, maxSize: 40_000_000 });

/** How long an answer is reused, in milliseconds. DUFFEL_CACHE_MINUTES=0 switches the cache off. */
export function cacheTtlMs() {
  const minutes = Number(process.env.DUFFEL_CACHE_MINUTES ?? "");
  return (process.env.DUFFEL_CACHE_MINUTES && minutes >= 0 ? minutes : DEFAULT_CACHE_MINUTES) * 60_000;
}

/** JSON with object keys in alphabetical order, so the same data always gives the same text. */
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const fields = Object.entries(value)
      .filter(([, field]) => field !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1));
    return `{${fields.map(([key, field]) => `${JSON.stringify(key)}:${stableJson(field)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/**
 * What makes two searches the same: everything sent to Duffel (route, dates,
 * passengers, cabin, stops, time of day), with airport codes in one spelling.
 */
export function searchCacheKey(payload: DuffelSearchPayload) {
  const code = (airport?: string) => airport?.trim().toUpperCase();
  return stableJson({
    ...payload,
    cabin_class: payload.cabin_class.trim().toLowerCase(),
    slices: payload.slices.map((slice) => ({
      ...slice,
      origin: code(slice.origin),
      destination: code(slice.destination),
    })),
  });
}

/**
 * The same as searchFlights, but a search Duffel answered in the last few
 * minutes is answered from memory instead of asking again. Only Duffel's own
 * answers are kept: never a failure, and never the sample offers.
 */
export function searchFlightsCached(
  payload: DuffelSearchPayload,
  signal?: AbortSignal,
): Promise<DuffelSearchResponse> {
  return orSampleOffers(async () => {
    const key = searchCacheKey(payload);
    // Parsed afresh for each caller, so nobody can change what the next one gets.
    const kept = cache.get(key);
    if (kept) return JSON.parse(kept);

    const text = await postToDuffel("/air/offer_requests", payload, signal);
    const answer = JSON.parse(text);
    cache.set(key, text, cacheTtlMs());
    return answer;
  }, signal);
}

/** Forgets every kept answer. For tests. */
export function clearSearchCache() {
  cache.clear();
}
