// Run with `npm test`. Duffel is replaced by a stand-in `fetch`, so nothing here uses the network.
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { DuffelTimeout } from "./duffel.ts";
import { clearStaysCache, searchStays, searchStaysCached, staysCacheKey, type DuffelStaysSearch } from "./duffel-stays.ts";

const realFetch = globalThis.fetch;
let calls: { url: string; init?: RequestInit }[] = [];

/** Replaces `fetch`. `answer` returns Duffel's response, or "hang" to never answer. */
function stubDuffel(answer: () => Response | "hang") {
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    const response = answer();
    if (response !== "hang") return Promise.resolve(response);
    // Like the real thing, a request that is waiting ends when its signal is aborted.
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    });
  }) as typeof fetch;
}

const hotels = (...ids: string[]) => Response.json({ data: { results: ids.map((id) => ({ id })) } });

const search = (changes: Partial<DuffelStaysSearch> = {}): DuffelStaysSearch => ({
  location: { radius: 5, geographic_coordinates: { latitude: 38.7223, longitude: -9.1393 } },
  check_in_date: "2099-01-05",
  check_out_date: "2099-01-08",
  guests: [{ type: "adult" }],
  rooms: 1,
  ...changes,
});

const near = (latitude: number, longitude: number) =>
  search({ location: { radius: 5, geographic_coordinates: { latitude, longitude } } });

beforeEach(() => {
  calls = [];
  clearStaysCache();
  process.env.DUFFEL_TOKEN = "test";
  delete process.env.DUFFEL_API_URL;
  delete process.env.DUFFEL_CACHE_MINUTES;
  delete process.env.DUFFEL_TIMEOUT_MS;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.DUFFEL_CACHE_MINUTES;
  delete process.env.DUFFEL_TIMEOUT_MS;
});

test("a stays search is posted to Duffel the way it expects", async () => {
  stubDuffel(() => hotels("srr_1"));

  assert.deepEqual(await searchStays(search()), { data: { results: [{ id: "srr_1" }] } });

  const [{ url, init }] = calls;
  assert.equal(url, "https://api.duffel.com/stays/search");
  assert.equal(init?.method, "POST");
  const headers = init?.headers as Record<string, string>;
  assert.equal(headers.Authorization, "Bearer test");
  assert.equal(headers["Duffel-Version"], "v2");
  assert.deepEqual(JSON.parse(String(init?.body)), { data: search() });
});

test("a refused search throws with what Duffel said", async () => {
  stubDuffel(() => Response.json({ errors: [{ message: "This feature is not enabled for your account." }] }, { status: 403 }));
  await assert.rejects(searchStays(search()), /not enabled for your account/);
});

test("Duffel is given up on when it takes too long, and dropped when the visitor stops waiting", async () => {
  stubDuffel(() => "hang");
  process.env.DUFFEL_TIMEOUT_MS = "40";
  await assert.rejects(searchStays(search()), DuffelTimeout);

  process.env.DUFFEL_TIMEOUT_MS = "5000";
  const visitor = new AbortController();
  setTimeout(() => visitor.abort(), 10);
  await assert.rejects(searchStays(search(), visitor.signal), { name: "AbortError" });
});

test("two searches are the same when they are for the same place, dates and guests", () => {
  const key = staysCacheKey(search());

  // A few metres away is still the same city centre.
  assert.equal(staysCacheKey(near(38.72234, -9.13926)), key);
  assert.equal(staysCacheKey(search({ free_cancellation_only: false })), key);

  const different = [
    near(38.73, -9.1393),
    search({ location: { ...search().location, radius: 10 } }),
    search({ check_in_date: "2099-01-06" }),
    search({ check_out_date: "2099-01-09" }),
    search({ guests: [{ type: "adult" }, { type: "adult" }] }),
    search({ rooms: 2 }),
    search({ free_cancellation_only: true }),
  ];
  for (const other of different) assert.notEqual(staysCacheKey(other), key);
});

test("the same stays search asks Duffel once", async () => {
  stubDuffel(() => hotels("srr_1", "srr_2"));

  const first = await searchStaysCached(search());
  const again = await searchStaysCached(search());
  assert.equal(calls.length, 1);
  assert.deepEqual(again, first);

  // Each caller gets its own copy.
  first.data?.results?.pop();
  assert.equal((await searchStaysCached(search())).data?.results?.length, 2);

  await searchStaysCached(search({ rooms: 2 }));
  assert.equal(calls.length, 2);
});

test("a failed stays search is never kept", async () => {
  stubDuffel(() => Response.json({ errors: [{ message: "Service unavailable" }] }, { status: 503 }));
  await assert.rejects(searchStaysCached(search()));

  stubDuffel(() => hotels("srr_real"));
  assert.deepEqual((await searchStaysCached(search())).data?.results, [{ id: "srr_real" }]);
  assert.equal(calls.length, 2);
});

test("DUFFEL_CACHE_MINUTES=0 switches the stays cache off too", async () => {
  process.env.DUFFEL_CACHE_MINUTES = "0";
  stubDuffel(() => hotels("srr_1"));

  await searchStaysCached(search());
  await searchStaysCached(search());
  assert.equal(calls.length, 2);
});
