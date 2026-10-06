// Searches flights with the Duffel API. Ported from api/src/services/duffel.js.
import type { DuffelOffer } from "../types/duffel";

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
 * Asks Duffel for offers. With DUFFEL_USE_MOCK=true, a failed request returns
 * the sample offers in data/mock-flights.json instead of throwing.
 *
 * Throws DuffelTimeout when Duffel takes too long. Aborting `signal` (the
 * visitor is no longer waiting) drops the request and throws an AbortError.
 */
export async function searchFlights(
  payload: DuffelSearchPayload,
  signal?: AbortSignal,
): Promise<DuffelSearchResponse> {
  // Read per call, so a changed .env.local is picked up without a restart.
  const baseUrl = process.env.DUFFEL_API_URL || DEFAULT_API_URL;
  const token = process.env.DUFFEL_ACCESS_TOKEN || process.env.DUFFEL_TOKEN;
  const timeout = AbortSignal.timeout(Number(process.env.DUFFEL_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS);

  try {
    if (!token) {
      throw new Error("Missing Duffel access token in DUFFEL_ACCESS_TOKEN (or DUFFEL_TOKEN).");
    }

    const response = await fetch(`${baseUrl}/air/offer_requests`, {
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

    const body = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(body));
    return body;
  } catch (cause) {
    // Nobody is waiting for the answer any more, sample or not.
    if (signal?.aborted) throw cause;

    const error = timeout.aborted ? new DuffelTimeout() : cause;
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
