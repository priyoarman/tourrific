// Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { tripTotal } from "./trip-total.ts";
import type { FlightOffer, Hotel } from "./types.ts";

const flight = { totalPrice: 250, currency: "EUR" } as FlightOffer;
const hotel = { nightlyPrice: 80, currency: "EUR" } as Hotel;

test("adds the flight to every night of the stay", () => {
  assert.equal(tripTotal(flight, hotel, { nights: 3, nightsAssumed: false }), 490);
});

test("adds nothing up for a one-way trip, whose nights are a guess", () => {
  assert.equal(tripTotal(flight, hotel, { nights: 1, nightsAssumed: true }), null);
});

test("adds nothing up across currencies", () => {
  assert.equal(tripTotal(flight, { ...hotel, currency: "GBP" }, { nights: 3, nightsAssumed: false }), null);
});
