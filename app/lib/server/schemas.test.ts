// Run with `npm test`. Checks what POST /api/trips accepts as a picked trip.
import assert from "node:assert/strict";
import { test } from "node:test";
import { HOTEL_GRADIENTS } from "../duffel-to-hotel.ts";
import { getHotels } from "../mock-results.ts";
import type { FlightOffer, Hotel } from "../types";
import type { StreamHotels } from "../types/stream-events";
import { pickedTripSchema } from "./schemas.ts";

const flight = (): FlightOffer => ({
  id: "off_0000AWr2VsUNIF1Vl91xg0",
  airline: { name: "Scandinavian Airlines", code: "SK", logoUrl: "https://assets.duffel.com/img/airlines/SK.svg" },
  flightNumber: "SK1001",
  outbound: {
    origin: "CPH",
    destination: "LIS",
    departureTime: "2026-11-12T08:30:00",
    arrivalTime: "2026-11-12T11:15:00",
    durationMinutes: 285,
    stops: [],
  },
  inbound: {
    origin: "LIS",
    destination: "CPH",
    departureTime: "2026-11-16T12:40:00",
    arrivalTime: "2026-11-16T19:05:00",
    durationMinutes: 325,
    stops: [{ airport: "AMS", layoverMinutes: 75 }],
  },
  totalPrice: 412.5,
  currency: "EUR",
  cabin: "Economy",
  fareBrand: "Economy Light",
  baggage: "1 carry-on bag",
});

const hotel = (): Hotel => ({
  id: "acc_0000AWr2VsUNIF1Vl91xg0",
  name: "Casa do Rio",
  area: "Rua da Prata 10, Lisbon",
  distanceKm: 1.2,
  stars: 4,
  rating: 8.6,
  reviewCount: 412,
  nightlyPrice: 120,
  currency: "EUR",
  amenities: ["Free Wi-Fi", "Pool"],
  photoUrl: "https://assets.duffel.com/img/stays/image.jpg",
  gradient: HOTEL_GRADIENTS[0],
  freeCancellation: true,
});

const stay = (): StreamHotels["stay"] => ({
  city: "Lisbon",
  around: "city",
  checkIn: "2026-11-12",
  checkOut: "2026-11-16",
  nights: 4,
  nightsAssumed: false,
  guests: 1,
  rooms: 1,
});

const trip = () => ({ flight: flight(), hotel: hotel(), stay: stay() });

/** The paths of the fields the schema rejects, e.g. ["stay.checkOut"]. */
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
