// Run with `npm test`. Needs no API key: it checks how the model's raw answer
// is cleaned up, and the date arithmetic. Ported from the Express backend's
// api/src/groq/testNormalize.js (`npm run test:extract:normalize`).
import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeTripQuery, parseNaturalTravelDates } from "./extractor.ts";

test("cleans a one-way search", () => {
  const oneWay = normalizeTripQuery({
    origin_airport: " cph ",
    destination_airport: "lis",
    departure_date: "2026-07-15",
    max_price: 1500,
    max_price_currency: "DKK",
    vibe_tags: ["budget", "beach"],
  });

  assert.deepEqual(oneWay, {
    trip_type: "one_way",
    origin_airport: "CPH",
    destination_airport: "LIS",
    destination_country: null,
    destination_country_code: null,
    destination_continent_code: null,
    destination_area: null,
    departure_date: "2026-07-15",
    return_date: null,
    max_price: 1500,
    max_price_currency: "DKK",
    cabin_class: null,
    passengers: null,
    vibe_tags: ["budget", "beach"],
    direct_only: null,
    preferred_airlines: [],
    baggage_required: null,
    departure_time: null,
    hotel_rooms: null,
    hotel_max_price: null,
    hotel_max_price_currency: null,
    hotel_min_stars: null,
    hotel_free_cancellation: null,
    hotel_amenities: [],
  });
});

test("cleans what was asked of the hotel", () => {
  const wishes = normalizeTripQuery({
    hotel_rooms: "2",
    hotel_max_price: "150",
    hotel_max_price_currency: "€",
    hotel_min_stars: 7,
    hotel_free_cancellation: "yes",
    hotel_amenities: ["Swimming pool", "free Wi-Fi", "pool", "dog friendly", "ocean view"],
  });

  assert.equal(wishes.hotel_rooms, 2);
  assert.equal(wishes.hotel_max_price, 150);
  assert.equal(wishes.hotel_max_price_currency, "EUR");
  // There is no such thing as a seven-star hotel to filter on.
  assert.equal(wishes.hotel_min_stars, 5);
  assert.equal(wishes.hotel_free_cancellation, true);
  // In the list's order, each once, and nothing that isn't on it.
  assert.deepEqual(wishes.hotel_amenities, ["wifi", "pool", "pet_friendly"]);
  // The hotel's price limit is its own; the flights have none here.
  assert.equal(wishes.max_price, null);

  const none = normalizeTripQuery({ hotel_rooms: 0, hotel_min_stars: "many", hotel_max_price_currency: "EUR", hotel_amenities: null });
  assert.equal(none.hotel_rooms, null);
  assert.equal(none.hotel_min_stars, null);
  // A currency without a price limits nothing.
  assert.equal(none.hotel_max_price_currency, null);
  assert.deepEqual(none.hotel_amenities, []);
});

test("cleans a return search with loosely written filters", () => {
  const returnTrip = normalizeTripQuery({
    trip_type: "round trip",
    origin_airport: "CPH",
    destination_airport: "BCN",
    departure_date: "2026-08-01",
    return_date: "2026-08-10",
    max_price: 2500,
    vibe_tags: ["budget"],
    direct_only: "yes",
    preferred_airlines: "SAS, Lufthansa",
    baggage_required: "true",
    departure_time: "Morning",
  });

  assert.equal(returnTrip.trip_type, "return");
  assert.equal(returnTrip.direct_only, true);
  assert.deepEqual(returnTrip.preferred_airlines, ["SAS", "Lufthansa"]);
  assert.equal(returnTrip.baggage_required, true);
  assert.equal(returnTrip.departure_time, "morning");
  // No currency was given, so the limit is in whatever currency the offers use.
  assert.equal(returnTrip.max_price, 2500);
  assert.equal(returnTrip.max_price_currency, null);
});

test("a return date makes it a return trip, whatever trip_type says", () => {
  // A return before the departure is kept as written here; the search itself
  // answers "The return date must be on or after your departure date."
  const backwards = normalizeTripQuery({
    trip_type: "one_way",
    origin_airport: "CPH",
    destination_airport: "BCN",
    departure_date: "2026-08-10",
    return_date: "2026-08-01",
  });

  assert.equal(backwards.trip_type, "return");
  assert.equal(backwards.departure_date, "2026-08-10");
  assert.equal(backwards.return_date, "2026-08-01");
});

test("works out relative dates from a Monday", () => {
  // Monday 6 July 2026.
  const referenceDate = new Date(2026, 6, 6);
  const dates = (text: string) => parseNaturalTravelDates(text, referenceDate);

  assert.deepEqual(dates("Flights to Rome tomorrow"), { departure_date: "2026-07-07", return_date: null });
  assert.deepEqual(dates("Flights to Rome this weekend"), { departure_date: "2026-07-11", return_date: null });
  assert.deepEqual(dates("Flights to Rome next weekend"), { departure_date: "2026-07-18", return_date: null });
  assert.deepEqual(dates("Flights to Rome next friday"), { departure_date: "2026-07-10", return_date: null });

  const september = dates("Flights to Rome in September");
  assert.match(september.departure_date!, /^2026-09-\d{2}$/);
  assert.equal(september.return_date, null);
});
