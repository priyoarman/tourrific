// Run with `npm test`. Uses Node's built-in test runner, so there is nothing to install.
import assert from "node:assert/strict";
import { test } from "node:test";
import { HOTEL_GRADIENTS, toHotel } from "./duffel-to-hotel.ts";
import type { DuffelStaysResult } from "./types/duffel-stays.ts";

// Shaped like the example in Duffel's API reference, not a recorded answer.
const result = (changes: Partial<DuffelStaysResult["accommodation"]> = {}): DuffelStaysResult => ({
  id: "srr_0000ASVBuJVLdmqtZDJ4ld",
  check_in_date: "2099-01-05",
  check_out_date: "2099-01-08",
  cheapest_rate_total_amount: "799.00",
  cheapest_rate_currency: "GBP",
  accommodation: {
    id: "acc_0000AWr2VsUNIF1Vl91xg0",
    name: "Duffel Test Hotel",
    rating: 4,
    review_score: 8.8,
    review_count: 336,
    photos: [{ url: "https://assets.duffel.com/img/stays/image.jpg" }, { url: "https://assets.duffel.com/img/stays/second.jpg" }],
    amenities: [
      { type: "parking", description: "Parking" },
      { type: "concierge", description: "Concierge" },
      { type: "wifi", description: "Wifi" },
      { type: "gym", description: "Fitness centre" },
    ],
    location: {
      address: { line_one: "10 Downing St", city_name: "London", postal_code: "SW1A 2AA", region: "England", country_code: "GB" },
      geographic_coordinates: { latitude: 51.5033, longitude: -0.1276 },
    },
    rooms: [{ rates: [{ total_amount: "799.00", total_currency: "GBP", cancellation_timeline: [] }] }],
    ...changes,
  },
});

// Trafalgar Square, about 500 metres from the hotel.
const centre = { latitude: 51.508, longitude: -0.1281 };

test("converts a Duffel stays result into a hotel card", () => {
  const hotel = toHotel(result(), centre);

  assert.deepEqual(hotel, {
    id: "acc_0000AWr2VsUNIF1Vl91xg0",
    name: "Duffel Test Hotel",
    area: "10 Downing St",
    distanceKm: 0.5,
    stars: 4,
    rating: 8.8,
    reviewCount: 336,
    // £799 for three nights.
    nightlyPrice: 266.33,
    currency: "GBP",
    // The ones people look for come first; the rest keep Duffel's wording.
    amenities: ["Wi-Fi", "Gym", "Parking"],
    photoUrl: "https://assets.duffel.com/img/stays/image.jpg",
    gradient: hotel.gradient,
    freeCancellation: false,
  });
  assert.ok(HOTEL_GRADIENTS.includes(hotel.gradient));
  assert.equal(toHotel(result(), centre).gradient, hotel.gradient);
});

test("a hotel with little known about it still converts", () => {
  const hotel = toHotel(
    result({ rating: null, review_score: null, review_count: null, photos: null, amenities: null, rooms: null, location: {} }),
    centre,
  );

  assert.equal(hotel.stars, null);
  assert.equal(hotel.rating, null);
  assert.equal(hotel.reviewCount, null);
  assert.equal(hotel.photoUrl, null);
  assert.equal(hotel.area, "");
  assert.equal(hotel.distanceKm, null);
  assert.deepEqual(hotel.amenities, []);
  assert.equal(hotel.freeCancellation, false);

  // No street: the city is better than nothing. No centre: no distance.
  const inCity = toHotel(result({ location: { address: { city_name: "London" }, geographic_coordinates: centre } }));
  assert.equal(inCity.area, "London");
  assert.equal(inCity.distanceKm, null);
});

test("the price is per night, whatever the length of the stay", () => {
  const oneNight = { ...result(), check_out_date: "2099-01-06" };
  assert.equal(toHotel(oneNight).nightlyPrice, 799);

  // Dates that make no stay are treated as one night rather than dividing by zero.
  assert.equal(toHotel({ ...result(), check_out_date: "2099-01-05" }).nightlyPrice, 799);
});

test("free cancellation needs a rate that gives everything back", () => {
  const withTimeline = (refund: string) =>
    result({
      rooms: [
        { rates: [{ total_amount: "799.00", total_currency: "GBP", cancellation_timeline: [{ before: "2099-01-03T00:00:00Z", refund_amount: refund, currency: "GBP" }] }] },
      ],
    });

  assert.equal(toHotel(withTimeline("799.00")).freeCancellation, true);
  assert.equal(toHotel(withTimeline("400.00")).freeCancellation, false);
});
