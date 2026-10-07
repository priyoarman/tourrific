// Searches hotels with the Duffel Stays API. The account has to have Stays
// switched on by Duffel; until then every search is refused with a 403.
import type { DuffelStaysResult } from "../types/duffel-stays";
import { cacheTtlMs, postToDuffel, stableJson } from "./duffel.ts";
import { createTtlCache } from "./ttl-cache.ts";

export type DuffelStaysSearch = {
  /** Where to look: every hotel within `radius` kilometres of a point. */
  location: {
    radius: number;
    geographic_coordinates: { latitude: number; longitude: number };
  };
  /** YYYY-MM-DD */
  check_in_date: string;
  /** YYYY-MM-DD, after `check_in_date`. */
  check_out_date: string;
  /** One entry per traveller, all searched as adults like the flights. */
  guests: { type: "adult" }[];
  rooms: number;
  /** Only hotels with a rate that can be cancelled for free. */
  free_cancellation_only?: boolean;
};

/** Duffel's answer to a stays search: one result per hotel, with its cheapest rate. */
export type DuffelStaysResponse = { data?: { results?: DuffelStaysResult[] } };

/**
 * Asks Duffel for hotels.
 *
 * Throws DuffelTimeout when Duffel takes too long. Aborting `signal` (the
 * visitor is no longer waiting) drops the request and throws an AbortError.
 */
export async function searchStays(search: DuffelStaysSearch, signal?: AbortSignal): Promise<DuffelStaysResponse> {
  return JSON.parse(await postToDuffel("/stays/search", search, signal));
}

// Kept as text like the flight answers, and for as long (DUFFEL_CACHE_MINUTES).
// 20 million characters is at most 40 MB.
const cache = createTtlCache({ maxEntries: 50, maxSize: 20_000_000 });

/**
 * What makes two searches the same: everything sent to Duffel, with the point
 * rounded to three decimals (about 100 metres) so one city is one search.
 */
export function staysCacheKey(search: DuffelStaysSearch) {
  const { latitude, longitude } = search.location.geographic_coordinates;
  const rounded = (degrees: number) => Math.round(degrees * 1000) / 1000;
  return stableJson({
    ...search,
    free_cancellation_only: search.free_cancellation_only ?? false,
    location: {
      radius: search.location.radius,
      geographic_coordinates: { latitude: rounded(latitude), longitude: rounded(longitude) },
    },
  });
}

/**
 * The same as searchStays, but a search Duffel answered in the last few
 * minutes is answered from memory instead of asking again. A failure is never kept.
 */
export async function searchStaysCached(search: DuffelStaysSearch, signal?: AbortSignal): Promise<DuffelStaysResponse> {
  const key = staysCacheKey(search);
  // Parsed afresh for each caller, so nobody can change what the next one gets.
  const kept = cache.get(key);
  if (kept) return JSON.parse(kept);

  const text = await postToDuffel("/stays/search", search, signal);
  const answer = JSON.parse(text);
  cache.set(key, text, cacheTtlMs());
  return answer;
}

/** Forgets every kept answer. For tests. */
export function clearStaysCache() {
  cache.clear();
}
