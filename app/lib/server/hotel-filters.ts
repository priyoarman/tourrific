import { AMENITY_LABELS, nightlyPrice } from "../duffel-to-hotel.ts";
import type { DuffelStaysResult } from "../types/duffel-stays";
import type { TripQuery } from "../types/trip-query";
import { convertPrice, money, passengerCount } from "./flight-filters.ts";

const GUESTS_PER_ROOM = 2;

export function roomCount(query: TripQuery) {
  const guests = passengerCount(query);
  const rooms = Math.round(Number(query.hotel_rooms)) || Math.ceil(guests / GUESTS_PER_ROOM);
  return Math.min(Math.max(rooms, 1), guests);
}

export function duffelStaysOptions(query: TripQuery) {
  return {
    guests: Array.from({ length: passengerCount(query) }, () => ({ type: "adult" as const })),
    rooms: roomCount(query),
    ...(query.hotel_free_cancellation && { free_cancellation_only: true }),
  };
}

export type HotelFilterResult = {
  results: DuffelStaysResult[];
  labels: string[];
  unfilteredCount: number;
};

export function filterStays(all: DuffelStaysResult[], query: TripQuery): HotelFilterResult {
  const labels: string[] = [];
  let results = all;

  if (query.hotel_min_stars) {
    const stars = query.hotel_min_stars;
    labels.push(stars >= 5 ? "5 stars" : `${stars}+ stars`);
    results = results.filter((result) => (result.accommodation.rating ?? 0) >= stars);
  }

  const amenities = query.hotel_amenities ?? [];
  for (const wanted of amenities) {
    labels.push(AMENITY_LABELS[wanted]);
    results = results.filter((result) => (result.accommodation.amenities ?? []).some((amenity) => amenity.type === wanted));
  }

  if (query.hotel_free_cancellation) labels.push("Free cancellation");

  if (query.hotel_max_price) {
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

  if (query.hotel_rooms && roomCount(query) > 1) labels.push(`${roomCount(query)} rooms`);

  return { results, labels, unfilteredCount: all.length };
}
