import type { DuffelOffer } from "../types/duffel";
import { createTtlCache } from "./ttl-cache.ts";

const DEFAULT_API_URL = "https://api.duffel.com";
const DEFAULT_TIMEOUT_MS = 20_000;

export class DuffelTimeout extends Error {
  constructor() {
    super("Duffel took too long to answer.");
    this.name = "DuffelTimeout";
  }
}

export type DuffelSearchSlice = {
  origin?: string;
  destination?: string;
  departure_date: string | null;
  departure_time?: { from: string; to: string };
};

export type DuffelSearchPayload = {
  slices: DuffelSearchSlice[];
  passengers: { type: string }[];
  cabin_class: string;
  max_connections?: number;
  [extra: string]: unknown;
};

export type DuffelSearchResponse = { data?: { offers?: DuffelOffer[] } };

export async function postToDuffel(path: string, payload: unknown, signal?: AbortSignal) {
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
    throw timeout.aborted && !signal?.aborted ? new DuffelTimeout() : error;
  }
}

async function orSampleOffers(search: () => Promise<DuffelSearchResponse>, signal?: AbortSignal) {
  try {
    return await search();
  } catch (error) {
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

export function searchFlights(payload: DuffelSearchPayload, signal?: AbortSignal): Promise<DuffelSearchResponse> {
  return orSampleOffers(async () => JSON.parse(await postToDuffel("/air/offer_requests", payload, signal)), signal);
}

const DEFAULT_CACHE_MINUTES = 10;

const cache = createTtlCache({ maxEntries: 50, maxSize: 40_000_000 });

export function cacheTtlMs() {
  const minutes = Number(process.env.DUFFEL_CACHE_MINUTES ?? "");
  return (process.env.DUFFEL_CACHE_MINUTES && minutes >= 0 ? minutes : DEFAULT_CACHE_MINUTES) * 60_000;
}

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

export function searchFlightsCached(
  payload: DuffelSearchPayload,
  signal?: AbortSignal,
): Promise<DuffelSearchResponse> {
  return orSampleOffers(async () => {
    const key = searchCacheKey(payload);
    const kept = cache.get(key);
    if (kept) return JSON.parse(kept);

    const text = await postToDuffel("/air/offer_requests", payload, signal);
    const answer = JSON.parse(text);
    cache.set(key, text, cacheTtlMs());
    return answer;
  }, signal);
}

export function clearSearchCache() {
  cache.clear();
}
