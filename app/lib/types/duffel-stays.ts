// The parts of a Duffel Stays search result this app reads. Duffel returns far
// more; add fields here only when something starts using them.
//
// Written from Duffel's API reference, not from a recorded answer: the account
// doesn't have Stays switched on yet. Check it against a real one when it does.

export type DuffelStaysRate = {
  /** What the whole stay costs at this rate, as a decimal string, e.g. "799.00". */
  total_amount: string;
  total_currency: string;
  /** How much comes back when cancelling before each moment. Empty when nothing does. */
  cancellation_timeline?: { before: string; refund_amount: string; currency: string }[] | null;
};

export type DuffelStaysAccommodation = {
  id: string;
  name: string;
  /** Stars, 1 to 5. Null when the hotel has none. */
  rating: number | null;
  /** What guests gave it, out of 10. Null when nobody reviewed it. */
  review_score: number | null;
  review_count?: number | null;
  photos?: { url: string }[] | null;
  /** `type` is a fixed word such as "wifi" or "parking"; `description` is its name in English. */
  amenities?: { type: string; description: string }[] | null;
  location: {
    address?: {
      line_one?: string | null;
      city_name?: string | null;
      postal_code?: string | null;
      region?: string | null;
      /** 2-letter country code, e.g. "PT". */
      country_code?: string | null;
    } | null;
    geographic_coordinates?: { latitude: number; longitude: number } | null;
  };
  /** A search only carries the rooms and rates it priced; the rates endpoint has them all. */
  rooms?: { rates?: DuffelStaysRate[] | null }[] | null;
};

/** One hotel in the answer to a search, with the cheapest rate found for the dates asked. */
export type DuffelStaysResult = {
  /** Identifies this hotel in this search. It expires; `accommodation.id` doesn't. */
  id: string;
  /** YYYY-MM-DD */
  check_in_date: string;
  check_out_date: string;
  accommodation: DuffelStaysAccommodation;
  /** For the whole stay and every guest, as a decimal string. */
  cheapest_rate_total_amount: string;
  cheapest_rate_currency: string;
};
