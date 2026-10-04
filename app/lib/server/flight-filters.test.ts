// Run with `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { DuffelOffer } from "../types/duffel.ts";
import type { TripQuery } from "../types/trip-query.ts";
import { duffelSearchOptions, filterOffers, passengerCount } from "./flight-filters.ts";
import { normalizeTripQuery } from "./groq/extractor.ts";

// 11 real offers, Copenhagen ⇄ London, priced in EUR: 3 direct and 8 with a stop.
const mockPath = new URL("./data/mock-flights.json", import.meta.url);
const offers: DuffelOffer[] = JSON.parse(readFileSync(mockPath, "utf8")).data.offers;

const query = (overrides: Partial<TripQuery> = {}): TripQuery => ({ ...normalizeTripQuery({}), ...overrides });
const kept = (overrides: Partial<TripQuery>) => filterOffers(offers, query(overrides));
const price = (offer: DuffelOffer) => Number.parseFloat(offer.total_amount);
const departure = (offer: DuffelOffer) => offer.slices[0].segments[0].departing_at.slice(11, 16);
const hasCheckedBag = (offer: DuffelOffer) =>
  offer.slices.every((slice) =>
    slice.segments.every((segment) => segment.passengers[0].baggages.some((b) => b.type === "checked" && b.quantity > 0)),
  );

test("no filters keeps every offer", () => {
  assert.deepEqual(kept({}), { offers, labels: [], unfilteredCount: offers.length });
});

test("asks Duffel for direct flights and a departure window", () => {
  assert.deepEqual(duffelSearchOptions(query()), {
    cabin_class: "economy",
    passengers: [{ type: "adult" }],
    outboundDepartureTime: undefined,
  });

  const options = duffelSearchOptions(query({ direct_only: true, departure_time: "morning", cabin_class: "business", passengers: 3 }));
  assert.equal(options.max_connections, 0);
  assert.deepEqual(options.outboundDepartureTime, { from: "05:00", to: "11:59" });
  assert.equal(options.cabin_class, "business");
  assert.equal(options.passengers.length, 3);

  assert.deepEqual(duffelSearchOptions(query({ departure_time: "evening" })).outboundDepartureTime, { from: "18:00", to: "21:59" });
  // Duffel rejects a window that crosses midnight, so none is sent for "night".
  assert.equal(duffelSearchOptions(query({ departure_time: "night" })).outboundDepartureTime, undefined);
  assert.equal("max_connections" in duffelSearchOptions(query({ direct_only: false })), false);
});

test("counts between 1 and 9 travellers", () => {
  assert.equal(passengerCount(query()), 1);
  assert.equal(passengerCount(query({ passengers: 4 })), 4);
  assert.equal(passengerCount(query({ passengers: 50 })), 9);
  assert.equal(passengerCount(query({ passengers: -2 })), 1);
});

test("direct only drops flights with a stop", () => {
  const result = kept({ direct_only: true });
  assert.ok(result.offers.length > 0 && result.offers.length < offers.length);
  assert.ok(result.offers.every((o) => o.slices.every((s) => s.segments.length === 1)));
  assert.deepEqual(result.labels, ["Direct"]);
  assert.equal(result.unfilteredCount, offers.length);
});

test("time of day keeps departures inside the window", () => {
  const morning = kept({ departure_time: "morning" });
  assert.ok(morning.offers.length > 0);
  assert.ok(morning.offers.every((o) => departure(o) >= "05:00" && departure(o) < "12:00"));
  assert.deepEqual(morning.labels, ["Morning departure"]);

  // Each offer falls in exactly one window, including the one that crosses midnight.
  const windows = (["morning", "afternoon", "evening", "night"] as const).map((w) => kept({ departure_time: w }).offers.length);
  assert.equal(windows.reduce((a, b) => a + b), offers.length);

  const late = { ...offers[0], slices: [{ ...offers[0].slices[0], segments: [{ ...offers[0].slices[0].segments[0], departing_at: "2026-11-12T23:30:00" }] }] };
  const early = { ...late, slices: [{ ...late.slices[0], segments: [{ ...late.slices[0].segments[0], departing_at: "2026-11-12T04:59:00" }] }] };
  assert.equal(filterOffers([late, early, offers[0]], query({ departure_time: "night" })).offers.length, 2);
});

test("baggage keeps only offers with a checked bag on every flight", () => {
  const result = kept({ baggage_required: true });
  assert.ok(result.offers.length > 0 && result.offers.length < offers.length);
  assert.ok(result.offers.every(hasCheckedBag));
  assert.equal(result.offers.length, offers.filter(hasCheckedBag).length);
  assert.deepEqual(result.labels, ["Checked bag included"]);
});

test("airlines match by code or by name", () => {
  const byCode = kept({ preferred_airlines: ["BA"] });
  assert.ok(byCode.offers.length > 0);
  assert.ok(byCode.offers.every((o) => o.owner.iata_code === "BA"));
  // The label shows the airline's name, not the code the model returned.
  assert.deepEqual(byCode.labels, ["British Airways"]);

  assert.deepEqual(kept({ preferred_airlines: ["british airways"] }).offers, byCode.offers);
  assert.deepEqual(kept({ preferred_airlines: ["British"] }).offers, byCode.offers);

  const two = kept({ preferred_airlines: ["BA", "LH"] });
  assert.ok(two.offers.length > byCode.offers.length);
  assert.deepEqual(two.labels, ["British Airways or Lufthansa"]);

  const none = kept({ preferred_airlines: ["Ryanair"] });
  assert.equal(none.offers.length, 0);
  assert.deepEqual(none.labels, ["Ryanair"]);
});

test("price limit in the offers' own currency", () => {
  const result = kept({ max_price: 150 });
  assert.ok(result.offers.length > 0 && result.offers.length < offers.length);
  assert.ok(result.offers.every((o) => price(o) <= 150));
  assert.deepEqual(result.labels, ["Under €150"]);
  assert.deepEqual(kept({ max_price: 150, max_price_currency: "EUR" }).offers, result.offers);
});

test("price limit in another currency is converted", () => {
  // 1,600 DKK is about €214: it keeps the €207.38 fare and drops the €217.69 one.
  const result = kept({ max_price: 1600, max_price_currency: "DKK" });
  assert.deepEqual(result.offers, offers.filter((o) => price(o) <= 1600 / 7.46));
  assert.equal(result.offers.length, 6);
  // Intl puts a non-breaking space after the currency code.
  assert.deepEqual(result.labels.map((l) => l.replace(/\u00a0/g, " ")), ["Under DKK 1,600 (about €214)"]);

  // A currency with no known rate can't be compared, so nothing is dropped, and the label says so.
  const unknown = kept({ max_price: 5000, max_price_currency: "THB" });
  assert.equal(unknown.offers.length, offers.length);
  assert.match(unknown.labels[0], /not applied: prices are in EUR/);
});

test("filters combine, and can leave nothing", () => {
  const result = kept({ direct_only: true, baggage_required: true, preferred_airlines: ["BA"], max_price: 150 });
  assert.ok(result.offers.every((o) => o.owner.iata_code === "BA" && hasCheckedBag(o) && price(o) <= 150));
  assert.deepEqual(result.labels, ["Direct", "Checked bag included", "British Airways", "Under €150"]);

  const nothing = kept({ direct_only: true, max_price: 1 });
  assert.deepEqual(nothing.offers, []);
  assert.equal(nothing.unfilteredCount, offers.length);

  assert.deepEqual(kept({ cabin_class: "business" }).labels, ["Business"]);
  assert.deepEqual(filterOffers([], query({ max_price: 100 })).labels, ["Under €100"]);
});
