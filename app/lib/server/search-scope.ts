// Works out which side of a trip a follow-up changes, so that "only direct
// flights" need not search the hotels again, nor "with a pool" the flights.
import type { TripQuery } from "../types/trip-query";

/** What a search has to look for again: the flights, the hotels, or both. */
export type SearchScope = "flights" | "hotels" | "both";

type Field = keyof TripQuery;

// Where and when the trip goes and for how many: both sides are searched with these.
// `trip_type` is not among them; whether there is a way back is told by `return_date`.
const SHARED: Field[] = ["destination_airport", "departure_date", "return_date", "passengers"];
const FLIGHTS_ONLY: Field[] = [
  "origin_airport",
  "max_price",
  "max_price_currency",
  "cabin_class",
  "direct_only",
  "preferred_airlines",
  "baggage_required",
  "departure_time",
];
const HOTELS_ONLY: Field[] = [
  "hotel_rooms",
  "hotel_max_price",
  "hotel_max_price_currency",
  "hotel_min_stars",
  "hotel_free_cancellation",
  "hotel_amenities",
];
// The rest (the mood, the country or region asked for, the explanation) only
// ever leads to a destination airport, which is compared itself.

/** What a field is left at when the visitor asked for nothing in particular. */
const UNASKED: Partial<Record<Field, unknown>> = { passengers: 1, cabin_class: "economy" };

/** A field's value in one spelling, so that only a real change counts as one. */
function comparable(query: TripQuery, field: Field) {
  const value = query[field] ?? UNASKED[field] ?? null;
  // The order things were asked for in doesn't matter.
  const text = Array.isArray(value)
    ? value.map((item) => String(item).trim().toLowerCase()).sort().join(",")
    : typeof value === "string"
      ? value.trim().toLowerCase()
      : value;
  // "Not direct only", an empty list and never having said are the same search.
  return text === false || text === "" ? null : text;
}

const differs = (previous: TripQuery, next: TripQuery, fields: Field[]) =>
  fields.some((field) => comparable(previous, field) !== comparable(next, field));

/**
 * Which side of the trip `next` changes compared with `previous`, the search
 * before it. Both are searches as they were run: follow-up merged in, and
 * origin and destination airport filled in.
 *
 * "both" when there is no previous search, when the place, dates or travellers
 * changed, and when nothing changed at all (the visitor asked for the same again).
 */
export function searchScope(previous: TripQuery | null | undefined, next: TripQuery): SearchScope {
  if (!previous || differs(previous, next, SHARED)) return "both";

  const flights = differs(previous, next, FLIGHTS_ONLY);
  const hotels = differs(previous, next, HOTELS_ONLY);
  if (flights === hotels) return "both";
  return flights ? "flights" : "hotels";
}
