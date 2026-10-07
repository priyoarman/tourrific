// Run with `npm test`. Groq and Duffel are replaced by a stand-in `fetch`, so nothing here uses the network.
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { clearSearchCache, searchCacheKey, searchFlightsCached, type DuffelSearchPayload } from "./duffel.ts";
import { clearStaysCache } from "./duffel-stays.ts";
import { runFlightSearch } from "./flight-search-stream.ts";
import { createTtlCache } from "./ttl-cache.ts";

const MINUTE = 60_000;

test("keeps a value until it expires", () => {
  let time = 0;
  const cache = createTtlCache({ maxEntries: 10, maxSize: 1000, now: () => time });

  cache.set("a", "first", 10 * MINUTE);
  time = 9 * MINUTE;
  assert.equal(cache.get("a"), "first");
  // Being read doesn't keep it alive longer.
  time = 10 * MINUTE;
  assert.equal(cache.get("a"), undefined);
  assert.deepEqual(cache.stats(), { entries: 0, size: 0 });

  // Expired entries nobody asks for again are cleared when something new is stored.
  cache.set("b", "second", MINUTE);
  time += 2 * MINUTE;
  cache.set("c", "third", MINUTE);
  assert.deepEqual(cache.stats(), { entries: 1, size: 5 });
});

test("is bounded by entries and by total size, dropping the least recently used", () => {
  const cache = createTtlCache({ maxEntries: 3, maxSize: 20, now: () => 0 });

  for (const key of ["a", "b", "c"]) cache.set(key, key.repeat(4), MINUTE);
  cache.get("a");
  cache.set("d", "dddd", MINUTE);
  // "b" was the one not used for longest.
  assert.deepEqual(["a", "b", "c", "d"].map((key) => cache.get(key) !== undefined), [true, false, true, true]);

  // Thirteen more characters don't fit beside twelve: the two oldest go to make room.
  cache.set("e", "e".repeat(13), MINUTE);
  assert.deepEqual(cache.stats(), { entries: 2, size: 17 });
  assert.equal(cache.get("e")?.length, 13);

  // Something that could never fit is not stored, and pushes nothing out.
  cache.set("f", "f".repeat(21), MINUTE);
  assert.equal(cache.get("f"), undefined);
  assert.deepEqual(cache.stats(), { entries: 2, size: 17 });

  // Storing under a key again replaces it.
  cache.set("e", "new", MINUTE);
  assert.equal(cache.get("e"), "new");
  assert.deepEqual(cache.stats(), { entries: 2, size: 7 });
});

const search = (changes: Partial<DuffelSearchPayload> = {}): DuffelSearchPayload => ({
  slices: [{ origin: "CPH", destination: "LIS", departure_date: "2099-01-05" }],
  passengers: [{ type: "adult" }],
  cabin_class: "economy",
  ...changes,
});

test("two searches are the same when everything sent to Duffel is", () => {
  const key = searchCacheKey(search());

  assert.equal(searchCacheKey({ cabin_class: "Economy", passengers: [{ type: "adult" }], slices: [{ departure_date: "2099-01-05", destination: " lis", origin: "cph" }] }), key);

  const different = [
    search({ slices: [{ origin: "CPH", destination: "LIS", departure_date: "2099-01-06" }] }),
    search({ slices: [{ origin: "AAL", destination: "LIS", departure_date: "2099-01-05" }] }),
    search({ slices: [...search().slices, { origin: "LIS", destination: "CPH", departure_date: "2099-01-12" }] }),
    search({ passengers: [{ type: "adult" }, { type: "adult" }] }),
    search({ cabin_class: "business" }),
    search({ max_connections: 0 }),
    search({ slices: [{ ...search().slices[0], departure_time: { from: "06:00", to: "11:59" } }] }),
  ];
  for (const other of different) assert.notEqual(searchCacheKey(other), key);
});

const realFetch = globalThis.fetch;
let calls: string[] = [];

/**
 * Replaces `fetch`: Groq reads "CPH to LIS" out of any message, and Duffel answers a flight search with `duffel()`.
 * The hotel search that goes with a chat search finds no city and no hotels.
 */
function stubProviders(duffel: () => Response) {
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("open-meteo")) return Promise.resolve(Response.json({}));
    if (url.includes("/stays/")) {
      calls.push("stays");
      return Promise.resolve(Response.json({ data: { results: [] } }));
    }
    calls.push(url.includes("duffel") ? "duffel" : "groq");
    if (url.includes("duffel")) return Promise.resolve(duffel());
    const content = JSON.stringify({ origin_airport: "CPH", destination_airport: "LIS", departure_date: "2099-01-05" });
    return Promise.resolve(
      Response.json({
        id: "x",
        model: "test",
        choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
    );
  }) as typeof fetch;
}

const offers = (...ids: string[]) => Response.json({ data: { offers: ids.map((id) => ({ id })) } });
const count = (who: string) => calls.filter((call) => call === who).length;

beforeEach(() => {
  calls = [];
  clearSearchCache();
  clearStaysCache();
  process.env.GROQ_API_KEY = "test";
  process.env.DUFFEL_TOKEN = "test";
  delete process.env.DUFFEL_USE_MOCK;
  delete process.env.DUFFEL_CACHE_MINUTES;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.DUFFEL_USE_MOCK;
  delete process.env.DUFFEL_CACHE_MINUTES;
});

test("the same search asks Duffel once", async () => {
  stubProviders(() => offers("off_1", "off_2"));

  const first = await searchFlightsCached(search());
  const again = await searchFlightsCached(search());
  assert.equal(count("duffel"), 1);
  assert.deepEqual(again, first);

  // Each caller gets its own copy.
  first.data?.offers?.pop();
  assert.equal((await searchFlightsCached(search())).data?.offers?.length, 2);

  await searchFlightsCached(search({ cabin_class: "business" }));
  assert.equal(count("duffel"), 2);
});

test("failures and sample flights are never kept", async () => {
  stubProviders(() => Response.json({ errors: [{ message: "Service unavailable" }] }, { status: 503 }));
  await assert.rejects(searchFlightsCached(search()));

  process.env.DUFFEL_USE_MOCK = "true";
  const sample = await searchFlightsCached(search());
  assert.ok(sample.data?.offers?.length);
  assert.equal(count("duffel"), 2);

  // Duffel is back: the next search gets real offers, not the sample ones again.
  stubProviders(() => offers("off_real"));
  assert.deepEqual((await searchFlightsCached(search())).data?.offers, [{ id: "off_real" }]);
});

test("DUFFEL_CACHE_MINUTES=0 switches the cache off", async () => {
  process.env.DUFFEL_CACHE_MINUTES = "0";
  stubProviders(() => offers("off_1"));

  await searchFlightsCached(search());
  await searchFlightsCached(search());
  assert.equal(count("duffel"), 2);
});

test("a repeated chat search still asks Groq, but not Duffel", async () => {
  stubProviders(() => offers());

  for (let i = 0; i < 3; i++) {
    const events: string[] = [];
    await runFlightSearch({ prompt: "Copenhagen to Lisbon on 5 January 2099" }, new Headers(), (event) => events.push(event));
    assert.deepEqual(events.slice(-3), ["complete", "hotels", "done"]);
  }

  assert.equal(count("groq"), 3);
  assert.equal(count("duffel"), 1);
  // The hotels of a repeated search are remembered like its flights.
  assert.equal(count("stays"), 1);
});
