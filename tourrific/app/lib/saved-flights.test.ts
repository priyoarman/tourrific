// Run with `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { errorMessage } from "./api.ts";
import { isExpired } from "./auth-store.ts";
import { toFlightOffer } from "./duffel-to-flight-offer.ts";
import { findSaved, toSavedFlight, toSavePayload } from "./saved-flights.ts";

const mockPath = new URL("../../../api/src/data/mock-flights.json", import.meta.url);
const offers = JSON.parse(readFileSync(mockPath, "utf8")).data.offers.map(toFlightOffer);
const offer = offers[0];

// What the backend sends back for a saved offer.
const rowFor = (payload: ReturnType<typeof toSavePayload>, id = "7") => ({
  id,
  flightNumber: payload.flight_number,
  airlineCode: payload.airline_code,
  airlineName: payload.airline_name,
  origin: payload.origin,
  destination: payload.destination,
  price: payload.price.toFixed(2),
  departureTime: new Date(payload.departure_time).toISOString(),
  currency: { code: payload.currency_code },
});

test("builds the payload the save endpoint expects", () => {
  const payload = toSavePayload(offer);
  assert.match(payload.flight_number, /^[A-Z0-9]{2}\d+$/);
  assert.equal(payload.origin.length, 3);
  assert.equal(payload.destination.length, 3);
  assert.ok(payload.price > 0);
  assert.equal(payload.currency_code, "EUR");
  // The airport's wall-clock time, marked as UTC so the server stores it unshifted.
  assert.equal(payload.departure_time, `${offer.outbound.departureTime}Z`);
});

test("a saved flight reads back with the time and price it was saved with", () => {
  const saved = toSavedFlight(rowFor(toSavePayload(offer)));
  assert.equal(saved.departureTime, offer.outbound.departureTime);
  assert.equal(saved.price, offer.totalPrice);
  assert.equal(saved.currency, "EUR");
  assert.equal(saved.airline.name, offer.airline.name);
  assert.equal(saved.airline.logoUrl, offer.airline.logoUrl);
});

test("finds the saved flight for an offer, and only for that fare", () => {
  const saved = [toSavedFlight(rowFor(toSavePayload(offer)))];
  assert.equal(findSaved(saved, offer)?.id, "7");
  assert.equal(findSaved(saved, { ...offer, totalPrice: offer.totalPrice + 10 }), undefined);
  assert.equal(findSaved([], offer), undefined);
});

test("reads a message out of each backend error shape", () => {
  assert.equal(errorMessage({ success: false, message: "Email already exists" }), "Email already exists");
  assert.equal(errorMessage({ error: "Failed to save message" }), "Failed to save message");
  assert.equal(errorMessage({ errors: { password: ["Too short"] } }), "password: Too short");
  assert.equal(errorMessage(null), null);
  assert.equal(errorMessage("Internal Server Error"), null);
});

test("knows when a token has expired", () => {
  const token = (exp: number) => `x.${btoa(JSON.stringify({ exp }))}.y`;
  const now = Date.parse("2026-10-03T12:00:00Z");
  assert.equal(isExpired(token(now / 1000 - 1), now), true);
  assert.equal(isExpired(token(now / 1000 + 3600), now), false);
  assert.equal(isExpired("not-a-token", now), false);
});
