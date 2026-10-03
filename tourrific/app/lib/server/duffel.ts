// Searches flights with the Duffel API. Ported from api/src/services/duffel.js.
import type { DuffelOffer } from "../types/duffel";

const DEFAULT_API_URL = "https://api.duffel.com";

export type DuffelSearchSlice = {
  origin?: string;
  destination?: string;
  /** YYYY-MM-DD */
  departure_date: string | null;
};

export type DuffelSearchPayload = {
  slices: DuffelSearchSlice[];
  passengers: { type: string }[];
  cabin_class: string;
  [extra: string]: unknown;
};

/** Duffel's answer to an offer request. Only the offers are used. */
export type DuffelSearchResponse = { data?: { offers?: DuffelOffer[] } };

/**
 * Asks Duffel for offers. With DUFFEL_USE_MOCK=true, a failed request returns
 * the sample offers in data/mock-flights.json instead of throwing.
 */
export async function searchFlights(payload: DuffelSearchPayload): Promise<DuffelSearchResponse> {
  // Read per call, so a changed .env.local is picked up without a restart.
  const baseUrl = process.env.DUFFEL_API_URL || DEFAULT_API_URL;
  const token = process.env.DUFFEL_ACCESS_TOKEN || process.env.DUFFEL_TOKEN;

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
    });

    const body = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(body));
    return body;
  } catch (error) {
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
