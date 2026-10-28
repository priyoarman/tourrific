import type { SearchScope } from "../types/stream-events";
import type { TripQuery } from "../types/trip-query";

type Field = keyof TripQuery;

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

const UNASKED: Partial<Record<Field, unknown>> = { passengers: 1, cabin_class: "economy" };

function comparable(query: TripQuery, field: Field) {
  const value = query[field] ?? UNASKED[field] ?? null;
  const text = Array.isArray(value)
    ? value.map((item) => String(item).trim().toLowerCase()).sort().join(",")
    : typeof value === "string"
      ? value.trim().toLowerCase()
      : value;
  return text === false || text === "" ? null : text;
}

const differs = (previous: TripQuery, next: TripQuery, fields: Field[]) =>
  fields.some((field) => comparable(previous, field) !== comparable(next, field));

export function searchScope(previous: TripQuery | null | undefined, next: TripQuery): SearchScope {
  if (!previous || differs(previous, next, SHARED)) return "both";

  const flights = differs(previous, next, FLIGHTS_ONLY);
  const hotels = differs(previous, next, HOTELS_ONLY);
  if (flights === hotels) return "both";
  return flights ? "flights" : "hotels";
}
