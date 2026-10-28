import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { airportCity } from "./airports.ts";
import { clearStayLocations, stayLocation } from "./stay-location.ts";

const realFetch = globalThis.fetch;
const realWarn = console.warn;
let calls: URL[] = [];

function stubGeocoder(answer: () => Response | "hang") {
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(new URL(String(input)));
    const response = answer();
    if (response !== "hang") return Promise.resolve(response);
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    });
  }) as typeof fetch;
}

const places = (...found: [latitude: number, longitude: number, kind?: string][]) =>
  Response.json({
    results: found.map(([latitude, longitude, kind = "PPLC"]) => ({ name: "x", latitude, longitude, feature_code: kind })),
  });

const LISBON: [number, number] = [38.72509, -9.1498];
const LIS = { latitude: 38.7813, longitude: -9.13592 };

beforeEach(() => {
  calls = [];
  clearStayLocations();
  console.warn = () => {};
  delete process.env.GEOCODER_TIMEOUT_MS;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  console.warn = realWarn;
  delete process.env.GEOCODER_TIMEOUT_MS;
});

test("hotels are searched around the centre of the city the airport serves", async () => {
  stubGeocoder(() => places(LISBON));

  assert.deepEqual(await stayLocation(" lis "), {
    latitude: 38.72509,
    longitude: -9.1498,
    radius: 5,
    city: "Lisbon",
    around: "city",
  });

  const [url] = calls;
  assert.equal(url.origin + url.pathname, "https://geocoding-api.open-meteo.com/v1/search");
  assert.equal(url.searchParams.get("name"), "Lisbon");
  assert.equal(url.searchParams.get("countryCode"), "PT");
});

test("a city is looked up once", async () => {
  stubGeocoder(() => places(LISBON));

  const first = await stayLocation("LIS");
  assert.deepEqual(await stayLocation("LIS"), first);
  assert.equal(calls.length, 1);
});

test("a place by the same name somewhere else is passed over", async () => {
  stubGeocoder(() => places([41.4, -8.5], LISBON));
  assert.equal((await stayLocation("LIS"))?.latitude, 38.72509);

  clearStayLocations();
  stubGeocoder(() => places([41.4, -8.5]));
  assert.equal((await stayLocation("LIS"))?.around, "airport");
});

test("only a town or city counts as the centre", async () => {
  stubGeocoder(() => places([38.78, -9.13, "AIRP"], LISBON));
  assert.equal((await stayLocation("LIS"))?.latitude, 38.72509);

  clearStayLocations();
  stubGeocoder(() => places([38.78, -9.13, "AIRP"]));
  assert.equal((await stayLocation("LIS"))?.around, "airport");
});

test("without the city centre, the airport is searched around with a wider radius", async () => {
  const fromAirport = { ...LIS, radius: 25, city: "Lisbon", around: "airport" };

  stubGeocoder(() => new Response("down", { status: 503 }));
  assert.deepEqual(await stayLocation("LIS"), fromAirport);

  stubGeocoder(() => Response.json({}));
  assert.deepEqual(await stayLocation("LIS"), fromAirport);

  process.env.GEOCODER_TIMEOUT_MS = "30";
  stubGeocoder(() => "hang");
  assert.deepEqual(await stayLocation("LIS"), fromAirport);

  stubGeocoder(() => places(LISBON));
  assert.equal((await stayLocation("LIS"))?.around, "city");
  assert.equal(calls.length, 4);
});

test("a visitor who stops waiting ends the lookup", async () => {
  stubGeocoder(() => "hang");
  const visitor = new AbortController();
  setTimeout(() => visitor.abort(), 10);

  assert.equal((await stayLocation("LIS", visitor.signal))?.around, "airport");
});

test("a code that isn't an airport has nowhere to search", async () => {
  stubGeocoder(() => places(LISBON));

  assert.equal(await stayLocation("ZZZZ"), null);
  assert.equal(await stayLocation(""), null);
  assert.equal(calls.length, 0);
});

test("an airport is named by the city it serves", () => {
  assert.equal(airportCity("LIS"), "Lisbon");
  assert.equal(airportCity(" cdg "), "Paris");
  assert.equal(airportCity("ZZZ"), null);
  assert.equal(airportCity(""), null);
});
