import assert from "node:assert/strict";
import { test } from "node:test";
import { getHotels } from "../mock-results.ts";
import { pickedTripSchema } from "./schemas.ts";
import { flight, hotel, stay, trip } from "./trip-fixtures.ts";

function rejected(body: unknown) {
  const result = pickedTripSchema.safeParse(body);
  assert.equal(result.success, false, "expected the trip to be rejected");
  return result.error!.issues.map((issue) => issue.path.join("."));
}

test("accepts a picked round trip as it is", () => {
  assert.deepEqual(pickedTripSchema.parse(trip()), trip());
});

test("accepts a one-way trip with a guessed stay", () => {
  const oneWay = { ...trip(), flight: { ...flight(), inbound: null } };
  oneWay.stay = { ...stay(), checkOut: "2026-11-15", nights: 3, nightsAssumed: true };
  assert.equal(pickedTripSchema.safeParse(oneWay).success, true);
});

test("accepts the sample hotels the planner shows when a search fails", () => {
  const hotels = getHotels({ city: "Lisbon", airport: "LIS", nightlyRate: 110 });
  for (const sampleHotel of hotels) {
    const result = pickedTripSchema.safeParse({ ...trip(), hotel: sampleHotel, sample: true });
    assert.equal(result.success, true, `${sampleHotel.name}: ${result.error?.message}`);
  }
});

test("drops fields it doesn't know", () => {
  const parsed = pickedTripSchema.parse({ ...trip(), hotel: { ...hotel(), secret: "x" }, extra: 1 });
  assert.equal("secret" in parsed.hotel, false);
  assert.equal("extra" in parsed, false);
});

test("rejects a missing or mistyped part", () => {
  assert.deepEqual(rejected({ flight: flight(), stay: stay() }), ["hotel"]);
  assert.deepEqual(rejected({ ...trip(), hotel: { ...hotel(), nightlyPrice: "120" } }), ["hotel.nightlyPrice"]);
  assert.deepEqual(rejected({ ...trip(), flight: { ...flight(), currency: "eur" } }), ["flight.currency"]);
  assert.equal(pickedTripSchema.safeParse(null).success, false);
});

test("rejects text that is far too long", () => {
  assert.deepEqual(rejected({ ...trip(), hotel: { ...hotel(), name: "x".repeat(201) } }), ["hotel.name"]);
  const amenities = Array.from({ length: 31 }, (_, i) => `Amenity ${i}`);
  assert.deepEqual(rejected({ ...trip(), hotel: { ...hotel(), amenities } }), ["hotel.amenities"]);
});

test("only takes https images", () => {
  assert.deepEqual(rejected({ ...trip(), hotel: { ...hotel(), photoUrl: "javascript:alert(1)" } }), ["hotel.photoUrl"]);
  assert.deepEqual(rejected({ ...trip(), hotel: { ...hotel(), photoUrl: "http://example.com/a.jpg" } }), ["hotel.photoUrl"]);
  assert.equal(pickedTripSchema.safeParse({ ...trip(), hotel: { ...hotel(), photoUrl: null } }).success, true);
});

test("rejects a gradient that isn't Tailwind classes", () => {
  assert.deepEqual(rejected({ ...trip(), hotel: { ...hotel(), gradient: '"><script>' } }), ["hotel.gradient"]);
});

test("rejects a check-out that isn't `nights` after check-in", () => {
  assert.deepEqual(rejected({ ...trip(), stay: { ...stay(), checkOut: "2026-11-11" } }), ["stay.checkOut", "stay.checkOut"]);
  assert.deepEqual(rejected({ ...trip(), stay: { ...stay(), nights: 5 } }), ["stay.checkOut"]);
  const oneWay = { ...trip(), flight: { ...flight(), inbound: null } };
  assert.deepEqual(rejected({ ...oneWay, stay: { ...stay(), nights: 0, checkOut: "2026-11-12" } }), ["stay.nights"]);
});

test("rejects a stay that doesn't fit the flight", () => {
  const later = { ...stay(), checkIn: "2026-11-13", checkOut: "2026-11-16", nights: 3 };
  assert.deepEqual(rejected({ ...trip(), stay: later }), ["stay.checkIn"]);
  const longer = { ...stay(), checkOut: "2026-11-17", nights: 5 };
  assert.deepEqual(rejected({ ...trip(), stay: longer }), ["stay.checkOut"]);
});
