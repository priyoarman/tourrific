// Run with `npm test`. Covers turning a picked trip into a row and back; no database needed.
import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma, type Trip } from "@prisma/client";
import { flight, hotel, stay, trip } from "./trip-fixtures.ts";
import { tripLimitRules } from "./trip-limits.ts";
import { parseTripId, toStoredTrip, toTripRow, toTripSummary, tripForViewer } from "./trips.ts";

const ID = "3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b";

test("reads a trip id only when it is a UUID", () => {
  assert.equal(parseTripId(ID), ID);
  assert.equal(parseTripId(ID.toUpperCase()), ID);
  assert.equal(parseTripId("42"), null);
  assert.equal(parseTripId(`${ID}x`), null);
  assert.equal(parseTripId("'; drop table trips; --"), null);
});

test("turns a round trip into a row", () => {
  const row = toTripRow(trip());
  assert.deepEqual(row.flight, flight());
  assert.deepEqual(row.hotel, hotel());
  assert.deepEqual(row.stay, stay());
  assert.equal(row.origin, "CPH");
  assert.equal(row.destination, "LIS");
  assert.equal(row.city, "Lisbon");
  assert.equal(row.checkIn.toISOString(), "2026-11-12T00:00:00.000Z");
  assert.equal(row.checkOut.toISOString(), "2026-11-16T00:00:00.000Z");
  // 412.50 for the flights and 4 nights at 120.
  assert.equal(row.totalPrice, 892.5);
  assert.equal(row.currency, "EUR");
  assert.equal(row.sample, false);
});

test("leaves the total out when it can't be added up", () => {
  const oneWay = {
    flight: { ...flight(), inbound: null },
    hotel: hotel(),
    stay: { ...stay(), checkOut: "2026-11-15", nights: 3, nightsAssumed: true },
  };
  assert.equal(toTripRow(oneWay).totalPrice, null);

  const inDollars = toTripRow({ ...trip(), hotel: { ...hotel(), currency: "USD" } });
  assert.equal(inDollars.totalPrice, null);
  assert.equal(inDollars.currency, "EUR");
});

test("keeps the sample flag", () => {
  assert.equal(toTripRow({ ...trip(), sample: true }).sample, true);
});

/** What Prisma hands back for the trip in trip-fixtures.ts once it is saved. */
const storedRow = (changes: Partial<Trip> = {}): Trip => ({
  id: ID,
  userId: BigInt(42),
  createdAt: new Date("2026-10-28T10:00:00Z"),
  savedAt: new Date("2026-10-28T10:05:00Z"),
  flight: flight() as Prisma.JsonObject,
  hotel: hotel() as Prisma.JsonObject,
  stay: stay() as Prisma.JsonObject,
  origin: "CPH",
  destination: "LIS",
  city: "Lisbon",
  checkIn: new Date("2026-11-12T00:00:00Z"),
  checkOut: new Date("2026-11-16T00:00:00Z"),
  totalPrice: new Prisma.Decimal("892.50"),
  currency: "EUR",
  sample: false,
  ...changes,
});

test("reads a stored trip back as it was picked", () => {
  const stored = toStoredTrip(storedRow());
  assert.equal(stored.id, ID);
  assert.equal(stored.userId, "42");
  assert.deepEqual(stored.flight, flight());
  assert.deepEqual(stored.hotel, hotel());
  assert.deepEqual(stored.stay, stay());
  assert.equal(stored.sample, false);
});

test("reads a guest's unsaved trip", () => {
  const stored = toStoredTrip(storedRow({ userId: null, savedAt: null }));
  assert.equal(stored.userId, null);
  assert.equal(stored.savedAt, null);
});

test("sums up a saved trip for the list", () => {
  assert.deepEqual(toTripSummary(storedRow()), {
    id: ID,
    origin: "CPH",
    destination: "LIS",
    city: "Lisbon",
    checkIn: "2026-11-12",
    checkOut: "2026-11-16",
    totalPrice: 892.5,
    currency: "EUR",
    sample: false,
    savedAt: new Date("2026-10-28T10:05:00Z"),
  });
  assert.equal(toTripSummary(storedRow({ totalPrice: null })).totalPrice, null);
});

test("tells a visitor whose trip it is, without the owner's id", () => {
  const owned = toStoredTrip(storedRow());
  assert.equal(tripForViewer(owned, BigInt(42)).owner, "you");
  assert.equal(tripForViewer(owned, BigInt(7)).owner, "someone-else");
  assert.equal(tripForViewer(owned, null).owner, "someone-else");

  const guests = toStoredTrip(storedRow({ userId: null, savedAt: null }));
  assert.equal(tripForViewer(guests, null).owner, null);
  assert.equal(tripForViewer(guests, BigInt(42)).owner, null);

  assert.equal("userId" in tripForViewer(owned, BigInt(42)), false);
});

test("counts trips per account, or per address for a guest", () => {
  const headers = new Headers({ "x-forwarded-for": "203.0.113.7" });
  assert.equal(tripLimitRules({ userId: BigInt(42) }, headers)[0].key, "user:42");
  assert.equal(tripLimitRules(null, headers)[0].key, "ip:203.0.113.7");
  assert.equal(tripLimitRules(null, headers)[0].limit, 50);
});
