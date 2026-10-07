// Run with `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { errorMessage } from "./api.ts";
import { getSession, setSession } from "./auth-store.ts";
import { toFlightOffer } from "./duffel-to-flight-offer.ts";
import { findSaved, toSavedFlight, toSavePayload } from "./saved-flights.ts";

const mockPath = new URL("./server/data/mock-flights.json", import.meta.url);
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

test("remembers who signed in, and never a token", () => {
  const user = { id: "42", name: "Ada", email: "a@example.com", currency: { code: "DKK" } };
  // What a login from before the session cookie left behind.
  const items = new Map([["tourrific.session", JSON.stringify({ token: "old.jwt.token", user })]]);
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => void items.set(key, value),
      removeItem: (key: string) => void items.delete(key),
    },
  };

  assert.deepEqual(getSession(), { user });
  assert.equal(items.get("tourrific.session"), JSON.stringify({ user }));

  const other = { ...user, id: "7", email: "b@example.com" };
  setSession({ user: other });
  assert.deepEqual(getSession(), { user: other });
  assert.equal(items.get("tourrific.session"), JSON.stringify({ user: other }));

  setSession(null);
  assert.equal(getSession(), null);
  assert.equal(items.size, 0);

  delete (globalThis as { window?: unknown }).window;
});
