import type { DuffelStaysResult } from "../types/duffel-stays";
import { cacheTtlMs, postToDuffel, stableJson } from "./duffel.ts";
import { createTtlCache } from "./ttl-cache.ts";

export type DuffelStaysSearch = {
  location: {
    radius: number;
    geographic_coordinates: { latitude: number; longitude: number };
  };
  check_in_date: string;
  check_out_date: string;
  guests: { type: "adult" }[];
  rooms: number;
  free_cancellation_only?: boolean;
};

export type DuffelStaysResponse = { data?: { results?: DuffelStaysResult[] } };

export async function searchStays(search: DuffelStaysSearch, signal?: AbortSignal): Promise<DuffelStaysResponse> {
  return JSON.parse(await postToDuffel("/stays/search", search, signal));
}

const cache = createTtlCache({ maxEntries: 50, maxSize: 20_000_000 });

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

export async function searchStaysCached(search: DuffelStaysSearch, signal?: AbortSignal): Promise<DuffelStaysResponse> {
  const key = staysCacheKey(search);
  const kept = cache.get(key);
  if (kept) return JSON.parse(kept);

  const text = await postToDuffel("/stays/search", search, signal);
  const answer = JSON.parse(text);
  cache.set(key, text, cacheTtlMs());
  return answer;
}

export function clearStaysCache() {
  cache.clear();
}
