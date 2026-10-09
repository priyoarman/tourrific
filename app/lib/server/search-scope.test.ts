// Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import type { TripQuery } from "../types/trip-query";
import { searchScope } from "./search-scope.ts";

const trip = (changes: Partial<TripQuery> = {}) =>
  ({
    trip_type: "return",
    origin_airport: "CPH",
    destination_airport: "ATH",
    departure_date: "2099-01-05",
    return_date: "2099-01-08",
    passengers: 2,
    ...changes,
  }) as TripQuery;

test("a first search looks for both", () => {
  assert.equal(searchScope(null, trip()), "both");
  assert.equal(searchScope(undefined, trip()), "both");
});

test("a new place, date or number of travellers looks for both", () => {
  assert.equal(searchScope(trip(), trip({ destination_airport: "LIS" })), "both");
  assert.equal(searchScope(trip(), trip({ departure_date: "2099-01-06" })), "both");
  assert.equal(searchScope(trip(), trip({ return_date: "2099-01-10" })), "both");
  assert.equal(searchScope(trip(), trip({ return_date: null, trip_type: "one_way" })), "both");
  assert.equal(searchScope(trip(), trip({ passengers: 3 })), "both");
});

test("what is only asked of the flights looks for the flights", () => {
  const changes: Partial<TripQuery>[] = [
    { origin_airport: "AAL" },
    { max_price: 200 },
    { max_price: 200, max_price_currency: "EUR" },
    { cabin_class: "business" },
    { direct_only: true },
    { preferred_airlines: ["SK"] },
    { baggage_required: true },
    { departure_time: "morning" },
  ];
  for (const change of changes) assert.equal(searchScope(trip(), trip(change)), "flights", JSON.stringify(change));

  // Taking a wish back is a change too.
  assert.equal(searchScope(trip({ direct_only: true }), trip()), "flights");
});

test("what is only asked of the hotel looks for the hotels", () => {
  const changes: Partial<TripQuery>[] = [
    { hotel_rooms: 2 },
    { hotel_max_price: 150 },
    { hotel_max_price: 150, hotel_max_price_currency: "EUR" },
    { hotel_min_stars: 4 },
    { hotel_free_cancellation: true },
    { hotel_amenities: ["pool"] },
  ];
  for (const change of changes) assert.equal(searchScope(trip(), trip(change)), "hotels", JSON.stringify(change));

  assert.equal(searchScope(trip({ hotel_amenities: ["pool", "spa"] }), trip({ hotel_amenities: ["pool"] })), "hotels");
});

test("a change to each side looks for both", () => {
  assert.equal(searchScope(trip(), trip({ direct_only: true, hotel_min_stars: 4 })), "both");
});

test("the same search again looks for both", () => {
  assert.equal(searchScope(trip(), trip()), "both");
});

test("another spelling of the same wish is not a change", () => {
  const before = trip({ direct_only: true, preferred_airlines: ["SK", "LH"], hotel_amenities: ["pool", "spa"] });

  // Unset, false, an empty list, one traveller and economy all mean "nothing in particular".
  const unasked = { passengers: null, cabin_class: null, baggage_required: null, hotel_free_cancellation: null, preferred_airlines: null, hotel_amenities: null };
  const spelled = { passengers: 1, cabin_class: "economy", baggage_required: false, hotel_free_cancellation: false, preferred_airlines: [], hotel_amenities: [] };
  assert.equal(searchScope(trip(unasked), trip({ ...(spelled as Partial<TripQuery>), hotel_min_stars: 4 })), "hotels");

  // Order and case don't matter, and neither do the fields that only led to the airport.
  const after = trip({
    direct_only: true,
    preferred_airlines: ["lh", "sk"],
    hotel_amenities: ["spa", "pool"],
    origin_airport: "cph",
    trip_type: null,
    vibe_tags: ["beaches"],
    destination_country: "Greece",
    explanation: "Since you want beaches…",
    hotel_rooms: 2,
  });
  assert.equal(searchScope(before, after), "hotels");
});
