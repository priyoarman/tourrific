// Run with `npm test`. Covers the backend logic that needs no network or database.
import assert from "node:assert/strict";
import { test } from "node:test";
import { requireUser, signToken } from "./auth.ts";
import { resolveDestination, resolveDestinationAirportInput } from "./destination-resolver.ts";
import { mergeFollowUpTripQuery } from "./follow-up.ts";
import { normalizeTripQuery, parseNaturalTravelDates } from "./groq/extractor.ts";
import { parseId, serialize } from "./http.ts";
import { clientIp, detectFallbackOrigin } from "./origin-fallback.ts";
import { runFlightSearch } from "./flight-search-stream.ts";

process.env.JWT_SECRET = "test-secret";

// Saturday 3 October 2026.
const TODAY = new Date(2026, 9, 3, 15, 30);

test("normalizes what the model returns", () => {
  assert.deepEqual(
    normalizeTripQuery({
      origin_airport: " cph ",
      destination_airport: "lis",
      departure_date: "2026-07-15",
      max_price: 1500,
      max_price_currency: "kr",
      vibe_tags: ["budget", "beach"],
    }),
    {
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
    },
  );

  const returnTrip = normalizeTripQuery({
    trip_type: "round trip",
    return_date: "2026-08-10",
    direct_only: "yes",
    preferred_airlines: "SAS, Lufthansa",
    baggage_required: "true",
    departure_time: "Morning",
    cabin_class: "Business class",
    passengers: "2 adults",
    max_price: "€150",
    max_price_currency: "€",
  });
  assert.equal(returnTrip.cabin_class, "business");
  assert.equal(returnTrip.passengers, 2);
  assert.equal(returnTrip.max_price, 150);
  assert.equal(returnTrip.max_price_currency, "EUR");
  // A currency without a price means nothing; odd values are dropped.
  assert.equal(normalizeTripQuery({ max_price_currency: "DKK" }).max_price_currency, null);
  assert.equal(normalizeTripQuery({ passengers: 40 }).passengers, 9);
  assert.equal(normalizeTripQuery({ passengers: 0, cabin_class: "cargo", departure_time: "noon" }).passengers, null);
  assert.equal(normalizeTripQuery({ cabin_class: "cargo" }).cabin_class, null);
  assert.equal(returnTrip.trip_type, "return");
  assert.equal(returnTrip.direct_only, true);
  assert.deepEqual(returnTrip.preferred_airlines, ["SAS", "Lufthansa"]);
  assert.equal(returnTrip.baggage_required, true);
  assert.equal(returnTrip.departure_time, "morning");

  // Anything unusable becomes an empty search rather than an error.
  assert.equal(normalizeTripQuery(null).destination_airport, null);
  assert.equal(normalizeTripQuery("nonsense").trip_type, "one_way");
});

test("works out relative dates", () => {
  const date = (text: string) => parseNaturalTravelDates(text, TODAY).departure_date;
  assert.equal(date("Paris tomorrow"), "2026-10-04");
  assert.equal(date("Copenhagen to London next Friday"), "2026-10-09");
  // Today is a Saturday: "this weekend" is today, "next weekend" a week on.
  assert.equal(date("somewhere this weekend"), "2026-10-03");
  assert.equal(date("beaches next weekend"), "2026-10-10");
  assert.equal(date("on saturday"), "2026-10-10");
  assert.equal(date("this saturday"), "2026-10-03");
  // A bare month picks a day in it that hasn't passed; a month already gone means next year.
  assert.match(date("Rome in december")!, /^2026-12-\d\d$/);
  assert.match(date("Rome in march")!, /^2027-03-\d\d$/);
  assert.equal(date("Rome in december"), date("Rome in december"));
  // Exact dates are left to the model.
  assert.equal(date("fly on 12 november"), null);
  assert.equal(date("London"), null);
  assert.equal(date(""), null);
});

test("resolves a typed destination to an airport", () => {
  assert.equal(resolveDestinationAirportInput("BCN"), "BCN");
  assert.equal(resolveDestinationAirportInput("Barcelona"), "BCN");
  assert.equal(resolveDestinationAirportInput("london"), "LHR");
  assert.equal(resolveDestinationAirportInput("Palma de Mallorca"), "PMI");
  assert.equal(resolveDestinationAirportInput("  "), null);
  assert.equal(resolveDestinationAirportInput(null), null);
});

test("picks an airport for a country, region or mood, and explains it", () => {
  const hints = { destination_airport: null, destination_country_code: null, destination_continent_code: null, destination_area: null, vibe_tags: [] as string[] };

  assert.deepEqual(resolveDestination(hints), { destination_airport: null, explanation: null });
  assert.deepEqual(resolveDestination({ ...hints, destination_airport: "cph" }), { destination_airport: "CPH", explanation: null });

  const beach = resolveDestination({ ...hints, vibe_tags: ["beaches"] });
  assert.match(beach.destination_airport!, /^[A-Z]{3}$/);
  assert.match(beach.explanation!, /^For a \*\*beaches\*\* getaway, I selected \*\*.+ \([A-Z]{3}\)\*\*/);

  const spain = resolveDestination({ ...hints, destination_country_code: "ES", destination_continent_code: "EU" });
  assert.match(spain.explanation!, /Since you want to fly to \*\*Spain\*\*/);

  const south = resolveDestination({ ...hints, destination_country_code: "EU", destination_continent_code: "EU", destination_area: "south of Europe" });
  assert.match(south.explanation!, /\*\*south\*\* region of Europe/);
});

test("merges a follow-up into the previous search", () => {
  const previous = normalizeTripQuery({ origin_airport: "CPH", destination_airport: "LHR", departure_date: "2026-10-09", return_date: "2026-10-16" });
  const nothingNew = normalizeTripQuery({});

  const later = mergeFollowUpTripQuery(nothingNew, previous, "A little later");
  assert.equal(later.destination_airport, "LHR");
  assert.equal(later.departure_date, "2026-10-12");
  assert.equal(later.return_date, "2026-10-19");
  assert.equal(later.trip_type, "return");

  assert.equal(mergeFollowUpTripQuery(nothingNew, previous, "later please").departure_date, "2026-10-16");
  assert.equal(mergeFollowUpTripQuery(nothingNew, previous, "a little earlier").departure_date, "2026-10-06");
  assert.equal(mergeFollowUpTripQuery(nothingNew, previous, "earlier").departure_date, "2026-10-02");

  const elsewhere = mergeFollowUpTripQuery(nothingNew, previous, "Somewhere else");
  assert.equal(elsewhere.destination_airport, null);
  assert.equal(elsewhere.departure_date, "2026-10-09");

  const south = mergeFollowUpTripQuery(nothingNew, { ...previous, destination_country: "Spain" }, "further south");
  assert.equal(south.destination_area, "south of Spain");
  assert.equal(south.destination_airport, null);

  const otherDate = mergeFollowUpTripQuery(nothingNew, previous, "another date");
  assert.equal(otherDate.departure_date, null);
  assert.equal(otherDate.destination_airport, "LHR");

  // A fresh request is not merged, with or without a previous search.
  const fresh = normalizeTripQuery({ destination_airport: "CDG", departure_date: "2026-11-01" });
  assert.equal(mergeFollowUpTripQuery(fresh, previous, "Paris on 1 November"), fresh);
  assert.equal(mergeFollowUpTripQuery(fresh, null, "a little later"), fresh);
});

test("reads the visitor's IP from x-forwarded-for", () => {
  const ip = (headers: Record<string, string>) => clientIp(new Headers(headers));
  assert.equal(ip({ "x-forwarded-for": "203.0.113.7, 10.0.0.1, 10.0.0.2" }), "203.0.113.7");
  assert.equal(ip({ "x-forwarded-for": "::ffff:203.0.113.7" }), "203.0.113.7");
  assert.equal(ip({ "x-real-ip": "198.51.100.4" }), "198.51.100.4");
  assert.equal(ip({ "x-forwarded-for": "::1" }), null);
  assert.equal(ip({ "x-forwarded-for": "127.0.0.1" }), null);
  assert.equal(ip({}), null);

  // Locally there is no usable IP, so searches start from Copenhagen.
  assert.equal(detectFallbackOrigin(new Headers()), "CPH");
  assert.match(detectFallbackOrigin(new Headers({ "x-forwarded-for": "8.8.8.8" })), /^[A-Z]{3}$/);
});

test("accepts its own tokens and nothing else", async () => {
  const withToken = (value?: string) =>
    new Request("http://localhost/api", { headers: value ? { authorization: value } : {} });
  const token = signToken({ id: BigInt(42), email: "a@example.com" });

  assert.deepEqual(requireUser(withToken(`Bearer ${token}`)), { userId: BigInt(42) });

  for (const bad of [undefined, token, "Bearer nope", `Bearer ${token}x`, `Basic ${token}`]) {
    const answer = requireUser(withToken(bad));
    assert.ok(answer instanceof Response);
    assert.equal(answer.status, 401);
  }

  // Signed with another secret.
  process.env.JWT_SECRET = "other-secret";
  const forged = signToken({ id: BigInt(42), email: "a@example.com" });
  process.env.JWT_SECRET = "test-secret";
  assert.ok(requireUser(withToken(`Bearer ${forged}`)) instanceof Response);
});

test("serializes ids and parses them back", () => {
  assert.deepEqual(serialize({ id: BigInt(7), nested: [{ userId: BigInt(9) }] }), { id: "7", nested: [{ userId: "9" }] });
  assert.equal(parseId("15"), BigInt(15));
  for (const bad of ["", "abc", "1.5", "-1", "1 OR 1=1", "9".repeat(30)]) assert.equal(parseId(bad), null);
});

test("a search without a prompt answers with one error event", async () => {
  for (const body of [null, {}, { prompt: "   " }, { prompt: 42 }, "text"]) {
    const events: [string, unknown][] = [];
    await runFlightSearch(body, new Headers(), (event, data) => events.push([event, data]));
    assert.deepEqual(events, [["error", { message: "Missing prompt." }]]);
  }
});
