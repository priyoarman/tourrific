// Run with `npm test`. Uses Node's built-in test runner, so there is nothing to install.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseIsoDuration, toFlightOffer } from "./duffel-to-flight-offer.ts";
import type { DuffelOffer } from "./types/duffel.ts";

// A trimmed copy of a real Duffel response: Copenhagen ⇄ London, 12–19 Nov 2026.
const mockPath = new URL("./server/data/mock-flights.json", import.meta.url);
const offers: DuffelOffer[] = JSON.parse(readFileSync(mockPath, "utf8")).data.offers;

const byAirline = (name: string, price?: string) => {
  const offer = offers.find((o) => o.owner.name === name && (!price || o.total_amount === price));
  assert.ok(offer, `no ${name} offer in the mock data`);
  return offer;
};

test("parses ISO durations", () => {
  assert.equal(parseIsoDuration("PT1H53M"), 113);
  assert.equal(parseIsoDuration("PT45M"), 45);
  assert.equal(parseIsoDuration("PT2H"), 120);
  assert.equal(parseIsoDuration("P1DT2H5M"), 1565);
  assert.equal(parseIsoDuration(null), null);
  assert.equal(parseIsoDuration("soon"), null);
});

test("converts a direct return flight", () => {
  const flight = toFlightOffer(byAirline("British Airways"));

  assert.deepEqual(flight.airline, {
    name: "British Airways",
    code: "BA",
    logoUrl: "https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/BA.svg",
  });
  assert.match(flight.flightNumber, /^BA\d+$/);
  assert.equal(flight.totalPrice, 96.85);
  assert.equal(flight.currency, "EUR");
  assert.equal(flight.cabin, "Economy");
  assert.equal(flight.fareBrand, "Basic");
  assert.equal(flight.baggage, "Cabin bag + 1 checked bag");

  assert.deepEqual(flight.outbound, {
    origin: "CPH",
    destination: "LHR",
    departureTime: "2026-11-12T08:30:00",
    arrivalTime: "2026-11-12T09:23:00",
    // 08:30 Copenhagen → 09:23 London is 1h 53m, not 53m: London is an hour behind.
    durationMinutes: 113,
    stops: [],
  });
  assert.equal(flight.inbound?.origin, "LHR");
  assert.equal(flight.inbound?.destination, "CPH");
  assert.equal(flight.inbound?.departureTime.slice(0, 10), "2026-11-19");
});

test("lists the stop and layover of a connecting flight", () => {
  const offer = byAirline("Lufthansa", "202.55");
  const flight = toFlightOffer(offer);
  const [first, second] = offer.slices[0].segments;

  assert.equal(flight.outbound.stops.length, 1);
  assert.equal(flight.outbound.stops[0].airport, first.destination.iata_code);
  assert.ok(flight.outbound.stops[0].layoverMinutes > 0);
  assert.equal(flight.outbound.departureTime, first.departing_at);
  assert.equal(flight.outbound.arrivalTime, second.arriving_at);
  assert.equal(flight.baggage, "Cabin bag only");

  // Flying time plus the layover adds up to Duffel's total for the direction.
  const flying = parseIsoDuration(first.duration)! + parseIsoDuration(second.duration)!;
  assert.equal(flight.outbound.durationMinutes, flying + flight.outbound.stops[0].layoverMinutes);
});

test("treats a single slice as a one-way trip", () => {
  const offer = byAirline("British Airways");
  const flight = toFlightOffer({ ...offer, slices: [offer.slices[0]] });
  assert.equal(flight.inbound, null);
});

test("copes with what Duffel sometimes leaves out", () => {
  const offer = byAirline("British Airways");
  const [slice] = offer.slices;
  const [segment] = slice.segments;

  const bare = toFlightOffer({
    ...offer,
    owner: { name: "Mystery Air", iata_code: null },
    slices: [
      {
        ...slice,
        // No total for the direction, no fare name, and no baggage or cabin details.
        duration: null,
        fare_brand_name: null,
        segments: [{ ...segment, passengers: [] }],
      },
    ],
  });

  assert.deepEqual(bare.airline, { name: "Mystery Air", code: "", logoUrl: null });
  assert.equal(bare.fareBrand, null);
  assert.equal(bare.cabin, "Economy");
  assert.equal(bare.baggage, "No baggage included");
  // Without Duffel's total, the flight's own duration is used.
  assert.equal(bare.outbound.durationMinutes, parseIsoDuration(segment.duration));
  assert.equal(bare.inbound, null);
});

test("converts every offer in the mock data", () => {
  for (const offer of offers) {
    const flight = toFlightOffer(offer);
    assert.ok(Number.isFinite(flight.totalPrice) && flight.totalPrice > 0, offer.id);
    assert.match(flight.currency, /^[A-Z]{3}$/);
    assert.ok(flight.airline.name);
    for (const slice of [flight.outbound, flight.inbound]) {
      assert.ok(slice, offer.id);
      assert.match(slice.departureTime, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
      assert.ok(slice.durationMinutes > 0, offer.id);
      assert.ok(slice.stops.every((stop) => stop.layoverMinutes > 0), offer.id);
    }
  }
});

test("converts the compact form the search endpoint sends for limit: \"all\"", async () => {
  const { compactOffer } = await import("./server/compact-offer.ts");
  for (const offer of offers) {
    const compact = compactOffer(offer);
    // Nothing the cards show may depend on a field the compact form drops.
    assert.deepEqual(toFlightOffer(compact), toFlightOffer(offer), offer.id);
    assert.ok(JSON.stringify(compact).length < JSON.stringify(offer).length);
  }
});
