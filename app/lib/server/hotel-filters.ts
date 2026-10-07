// Applies what the visitor asked of the hotel: stars, a price a night, things
// it must have, free cancellation and the number of rooms.
//
// Duffel only takes the rooms and free cancellation. The rest is checked here
// once the hotels are in.
import { AMENITY_LABELS, nightlyPrice } from "../duffel-to-hotel.ts";
import type { DuffelStaysResult } from "../types/duffel-stays";
import type { TripQuery } from "../types/trip-query";
import { convertPrice, money, passengerCount } from "./flight-filters.ts";

const GUESTS_PER_ROOM = 2;

/** Rooms to search for: what was asked, or two guests to a room. Never more rooms than guests. */
export function roomCount(query: TripQuery) {
  const guests = passengerCount(query);
  const rooms = Math.round(Number(query.hotel_rooms)) || Math.ceil(guests / GUESTS_PER_ROOM);
  return Math.min(Math.max(rooms, 1), guests);
}

/**
 * The parts of the request Duffel can filter itself. Field names are from
 * https://duffel.com/docs/api/v2/search
 */
export function duffelStaysOptions(query: TripQuery) {
  return {
    guests: Array.from({ length: passengerCount(query) }, () => ({ type: "adult" as const })),
    rooms: roomCount(query),
    ...(query.hotel_free_cancellation && { free_cancellation_only: true }),
  };
}

export type HotelFilterResult = {
  /** The hotels that fit everything the visitor asked for. */
  results: DuffelStaysResult[];
  /** One short label per filter in effect, e.g. "4+ stars", "Under €150 a night". */
  labels: string[];
  /** How many hotels the search found before filtering. */
  unfilteredCount: number;
};

/** Keeps the hotels that fit the visitor's wishes, and says which wishes those were. */
export function filterStays(all: DuffelStaysResult[], query: TripQuery): HotelFilterResult {
  const labels: string[] = [];
  let results = all;

  if (query.hotel_min_stars) {
    const stars = query.hotel_min_stars;
    labels.push(stars >= 5 ? "5 stars" : `${stars}+ stars`);
    // A hotel without stars can't be said to have enough of them.
    results = results.filter((result) => (result.accommodation.rating ?? 0) >= stars);
  }

  const amenities = query.hotel_amenities ?? [];
  for (const wanted of amenities) {
    labels.push(AMENITY_LABELS[wanted]);
    results = results.filter((result) => (result.accommodation.amenities ?? []).some((amenity) => amenity.type === wanted));
  }

  // Asked of Duffel, so every hotel it returned has such a rate.
  if (query.hotel_free_cancellation) labels.push("Free cancellation");

  if (query.hotel_max_price) {
    // Every hotel of a search is priced in the same currency: the Duffel account's.
    const currency = all[0]?.cheapest_rate_currency ?? query.hotel_max_price_currency ?? "EUR";
    const asked = money(query.hotel_max_price, query.hotel_max_price_currency ?? currency);
    const limit = convertPrice(query.hotel_max_price, query.hotel_max_price_currency ?? currency, currency);

    if (limit === null) {
      labels.push(`Under ${asked} a night (not applied: prices are in ${currency})`);
    } else {
      const converted = query.hotel_max_price_currency && query.hotel_max_price_currency !== currency;
      labels.push(converted ? `Under ${asked} a night (about ${money(Math.round(limit), currency)})` : `Under ${asked} a night`);
      results = results.filter((result) => nightlyPrice(result) <= limit);
    }
  }

  // Part of the search itself rather than a filter on its results.
  if (query.hotel_rooms && roomCount(query) > 1) labels.push(`${roomCount(query)} rooms`);

  return { results, labels, unfilteredCount: all.length };
}
