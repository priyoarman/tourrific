// Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import type { DuffelStaysResult } from "../types/duffel-stays";
import type { TripQuery } from "../types/trip-query";
import { normalizeTripQuery } from "./groq/extractor.ts";
import { duffelStaysOptions, filterStays, roomCount } from "./hotel-filters.ts";

const stay = (id: string, stars: number | null, total: string, amenities: string[] = [], currency = "EUR"): DuffelStaysResult => ({
  id: `srr_${id}`,
  // Two nights.
  check_in_date: "2099-01-05",
  check_out_date: "2099-01-07",
  cheapest_rate_total_amount: total,
  cheapest_rate_currency: currency,
  accommodation: {
    id,
    name: id,
    rating: stars,
    review_score: null,
    amenities: amenities.map((type) => ({ type, description: type })),
    location: {},
  },
});

// A night costs 60, 110, 150 and 400.
const stays = [
  stay("hostel", 2, "120.00", ["wifi"]),
  stay("plain", 3, "220.00", ["wifi", "parking"]),
  stay("nice", 4, "300.00", ["wifi", "pool", "gym"]),
  stay("grand", 5, "800.00", ["wifi", "pool", "spa", "parking"]),
];

const query = (overrides: Partial<TripQuery> = {}): TripQuery => ({ ...normalizeTripQuery({}), ...overrides });
const kept = (overrides: Partial<TripQuery>, from = stays) => filterStays(from, query(overrides));
const ids = (overrides: Partial<TripQuery>, from = stays) => kept(overrides, from).results.map((result) => result.accommodation.id);

test("no wishes keeps every hotel", () => {
  assert.deepEqual(kept({}), { results: stays, labels: [], unfilteredCount: 4 });
});

test("rooms follow the travellers unless the visitor says otherwise", () => {
  assert.equal(roomCount(query()), 1);
  assert.equal(roomCount(query({ passengers: 2 })), 1);
  assert.equal(roomCount(query({ passengers: 3 })), 2);
  assert.equal(roomCount(query({ passengers: 5 })), 3);
  assert.equal(roomCount(query({ passengers: 4, hotel_rooms: 4 })), 4);
  assert.equal(roomCount(query({ passengers: 4, hotel_rooms: 1 })), 1);
  // Nobody to sleep in the third room.
  assert.equal(roomCount(query({ passengers: 2, hotel_rooms: 3 })), 2);
});

test("asks Duffel for the rooms, the guests and free cancellation", () => {
  assert.deepEqual(duffelStaysOptions(query()), { guests: [{ type: "adult" }], rooms: 1 });
  assert.deepEqual(duffelStaysOptions(query({ passengers: 3, hotel_free_cancellation: true })), {
    guests: [{ type: "adult" }, { type: "adult" }, { type: "adult" }],
    rooms: 2,
    free_cancellation_only: true,
  });
  assert.equal("free_cancellation_only" in duffelStaysOptions(query({ hotel_free_cancellation: false })), false);
});

test("stars are a minimum, and a hotel without any doesn't count", () => {
  assert.deepEqual(ids({ hotel_min_stars: 4 }), ["nice", "grand"]);
  assert.deepEqual(kept({ hotel_min_stars: 4 }).labels, ["4+ stars"]);
  assert.deepEqual(kept({ hotel_min_stars: 5 }).labels, ["5 stars"]);
  assert.deepEqual(ids({ hotel_min_stars: 1 }, [...stays, stay("unrated", null, "100.00")]), ["hostel", "plain", "nice", "grand"]);
});

test("a hotel must have everything that was asked for", () => {
  assert.deepEqual(ids({ hotel_amenities: ["pool"] }), ["nice", "grand"]);
  assert.deepEqual(ids({ hotel_amenities: ["pool", "parking"] }), ["grand"]);
  assert.deepEqual(kept({ hotel_amenities: ["pool", "parking"] }).labels, ["Pool", "Parking"]);
  assert.deepEqual(ids({ hotel_amenities: ["pet_friendly"] }), []);
});

test("the price limit is for one night, in the currency it was given in", () => {
  assert.deepEqual(ids({ hotel_max_price: 150 }), ["hostel", "plain", "nice"]);
  assert.deepEqual(kept({ hotel_max_price: 150 }).labels, ["Under €150 a night"]);

  // 1000 kr is about €134.
  const kroner = kept({ hotel_max_price: 1000, hotel_max_price_currency: "DKK" });
  assert.deepEqual(kroner.results.map((result) => result.accommodation.id), ["hostel", "plain"]);
  // The amount is written with a non-breaking space after the currency.
  assert.match(kroner.labels[0], /^Under DKK\s1,000 a night \(about €134\)$/);

  // A currency that can't be compared limits nothing, and says so.
  const baht = kept({ hotel_max_price: 3000, hotel_max_price_currency: "THB" });
  assert.equal(baht.results.length, 4);
  assert.match(baht.labels[0], /not applied: prices are in EUR/);
});

test("free cancellation and extra rooms are labelled, though Duffel applies them", () => {
  const asked = kept({ passengers: 4, hotel_rooms: 3, hotel_free_cancellation: true, hotel_min_stars: 3 });
  assert.deepEqual(asked.labels, ["3+ stars", "Free cancellation", "3 rooms"]);
  assert.equal(asked.results.length, 3);
  assert.equal(asked.unfilteredCount, 4);

  // One room is nothing to mention.
  assert.deepEqual(kept({ passengers: 2, hotel_rooms: 1 }).labels, []);
});
