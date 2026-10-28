// Run with `npm test`. Checks how a picked trip becomes the itinerary's text.
import assert from "node:assert/strict";
import { test } from "node:test";
import { flight, hotel, stay, trip } from "../lib/server/trip-fixtures.ts";
import { formatDateRange } from "../lib/format.ts";
import { toItineraryView, type CityOf } from "./itinerary-view.ts";

const CITIES: Record<string, string> = { CPH: "Copenhagen", LIS: "Lisbon", AMS: "Amsterdam" };
const cityOf: CityOf = (code) => CITIES[code] ?? null;
const options = { today: "2026-10-28", cityOf };

const oneWay = () => ({
  flight: { ...flight(), inbound: null },
  hotel: hotel(),
  stay: { ...stay(), checkOut: "2026-11-15", nights: 3, nightsAssumed: true },
});

test("writes a date range as briefly as it can", () => {
  assert.equal(formatDateRange("2026-10-16", "2026-10-22"), "16 – 22 Oct 2026");
  assert.equal(formatDateRange("2026-10-30", "2026-11-03"), "30 Oct – 3 Nov 2026");
  assert.equal(formatDateRange("2026-12-30", "2027-01-02"), "30 Dec 2026 – 2 Jan 2027");
});

test("sums up a round trip", () => {
  const view = toItineraryView(trip(), options);
  assert.deepEqual(view.summary, ["Lisbon trip", "5 days", "12 – 16 Nov 2026"]);
  assert.equal(view.overview.title, "Lisbon trip");
  assert.equal(view.overview.airportCode, "LIS");
  assert.equal(
    view.overview.description,
    "4 nights in Lisbon at Casa do Rio, flying Scandinavian Airlines from Copenhagen.",
  );
  assert.deepEqual(view.overview.chips, ["5 days", "4 nights", "1 traveller"]);
  assert.deepEqual(view.overview.facts, [
    { label: "Dates", value: "12 – 16 Nov 2026" },
    { label: "Route", value: "CPH ⇄ LIS" },
    { label: "Stay", value: "Lisbon" },
  ]);
  assert.deepEqual(view.overview.image, { photoUrl: hotel().photoUrl, scene: "island" });
  // Only the sample trip has these.
  assert.equal(view.overview.vibe, null);
  assert.equal(view.overview.photoCount, null);
  assert.equal(view.overview.status, null);
});

test("lays out both flights", () => {
  const { flight: view } = toItineraryView(trip(), options);
  assert.equal(view.title, "Return flight");
  assert.equal(view.price, "€412.50 · round trip");
  assert.deepEqual(view.legs, [
    {
      label: "Outbound",
      date: "Thu 12 Nov",
      route: "Copenhagen → Lisbon",
      departTime: "08:30",
      departCode: "CPH",
      arriveTime: "11:15",
      arriveCode: "LIS",
      duration: "4h 45m · Direct",
    },
    {
      label: "Return",
      date: "Mon 16 Nov",
      route: "Lisbon → Copenhagen",
      departTime: "12:40",
      departCode: "LIS",
      arriveTime: "19:05",
      arriveCode: "CPH",
      duration: "5h 25m · 1 stop",
    },
  ]);
});

test("says when a flight lands on a later day", () => {
  const overnight = { ...flight().outbound, arrivalTime: "2026-11-13T06:10:00" };
  const view = toItineraryView({ ...trip(), flight: { ...flight(), outbound: overnight } }, options);
  assert.equal(view.flight.legs[0].duration, "4h 45m · Direct · +1 day");
});

test("names the airport when its city isn't known", () => {
  const view = toItineraryView(trip(), { ...options, cityOf: () => null });
  assert.equal(view.flight.legs[0].route, "CPH → LIS");
  // The stay names its own city.
  assert.equal(view.overview.title, "Lisbon trip");

  const nowhere = toItineraryView({ ...trip(), stay: { ...stay(), city: null } }, { ...options, cityOf: () => null });
  assert.equal(nowhere.overview.title, "LIS trip");
});

test("describes the hotel without inventing its hours", () => {
  const { hotel: view } = toItineraryView(trip(), options);
  assert.equal(view.name, "Casa do Rio");
  assert.equal(view.price, "4 nights · €480");
  assert.deepEqual(view.details, ["Rua da Prata 10, Lisbon", "4★", "8.6 / 10", "Free cancellation"]);
  assert.deepEqual(view.checkIn, { date: "Thu 12 Nov", time: null });
  assert.deepEqual(view.checkOut, { date: "Mon 16 Nov", time: null });
  assert.equal(view.sample, false);

  const plain = { ...hotel(), area: "", stars: null, rating: null, freeCancellation: false };
  assert.deepEqual(toItineraryView({ ...trip(), hotel: plain }, options).hotel.details, ["Lisbon"]);
  assert.equal(toItineraryView(trip(), { ...options, sample: true }).hotel.sample, true);
});

test("adds up the budget", () => {
  assert.deepEqual(toItineraryView(trip(), options).budget, {
    currency: "EUR",
    days: 5,
    lines: [
      { label: "Flights", amount: 412.5, color: "bg-iris" },
      { label: "Hotel", amount: 480, color: "bg-lavender" },
    ],
  });
  // Prices in two currencies aren't converted, so there is no budget to show.
  assert.equal(toItineraryView({ ...trip(), hotel: { ...hotel(), currency: "USD" } }, options).budget, null);
});

test("marks the trip on the calendar", () => {
  assert.deepEqual(toItineraryView(trip(), options).calendar, {
    start: "2026-11-12",
    end: "2026-11-16",
    today: "2026-10-28",
    activityDates: [],
  });
});

test("doesn't pretend a one-way trip has a known length", () => {
  const view = toItineraryView(oneWay(), options);
  assert.deepEqual(view.summary, ["Lisbon trip", "One way", "Thu 12 Nov"]);
  assert.deepEqual(view.overview.chips, ["One way", "3 nights at the hotel", "1 traveller"]);
  assert.equal(view.overview.facts[0].value, "From Thu 12 Nov");
  assert.equal(view.overview.facts[1].value, "CPH → LIS");
  assert.equal(view.flight.title, "Flight");
  assert.equal(view.flight.price, "€412.50 · one way");
  assert.equal(view.flight.legs.length, 1);
  assert.equal(view.hotel.price, "€120 a night");
  assert.equal(view.budget, null);
});

test("counts travellers", () => {
  const view = toItineraryView({ ...trip(), stay: { ...stay(), guests: 2 } }, options);
  assert.equal(view.overview.chips[2], "2 travellers");
});
