// Run with `npm test`. Groq and Duffel are replaced by a stand-in `fetch`, so nothing here uses the network.
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { DuffelTimeout, searchFlights } from "./duffel.ts";
import { runFlightSearch } from "./flight-search-stream.ts";
import { extractTripQuery } from "./groq/extractor.ts";

const realFetch = globalThis.fetch;
let calls: string[] = [];

/** Replaces `fetch`. `answer` gets the URL and returns a response, or "hang" to never answer. */
function stubFetch(answer: (url: string) => Response | "hang") {
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    const response = answer(url);
    if (response !== "hang") return Promise.resolve(response);
    // Like the real thing, a request that is waiting ends when its signal is aborted.
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    });
  }) as typeof fetch;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const SEARCH = { slices: [{ origin: "CPH", destination: "LIS", departure_date: "2026-11-12" }], passengers: [{ type: "adult" }], cabin_class: "economy" };

beforeEach(() => {
  calls = [];
  process.env.GROQ_API_KEY = "test";
  process.env.DUFFEL_TOKEN = "test";
  process.env.GROQ_TIMEOUT_MS = "40";
  process.env.DUFFEL_TIMEOUT_MS = "40";
  delete process.env.DUFFEL_USE_MOCK;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.GROQ_TIMEOUT_MS;
  delete process.env.DUFFEL_TIMEOUT_MS;
  delete process.env.DUFFEL_USE_MOCK;
});

test("Duffel is given up on when it takes too long", async () => {
  stubFetch(() => "hang");
  await assert.rejects(searchFlights(SEARCH), DuffelTimeout);

  // With sample data switched on, a timeout falls back to it like any other failure.
  process.env.DUFFEL_USE_MOCK = "true";
  assert.ok((await searchFlights(SEARCH)).data?.offers?.length);
});

test("a Duffel search is dropped when the visitor stops waiting", async () => {
  stubFetch(() => "hang");
  process.env.DUFFEL_TIMEOUT_MS = "5000";
  process.env.DUFFEL_USE_MOCK = "true";

  const visitor = new AbortController();
  setTimeout(() => visitor.abort(), 10);
  // Not a timeout, and no sample flights either: there is nobody to show them to.
  await assert.rejects(searchFlights(SEARCH, visitor.signal), { name: "AbortError" });
});

test("Groq is asked once when it is too slow, over its quota, or no longer needed", async () => {
  stubFetch(() => "hang");
  const slow = await extractTripQuery("to Lisbon tomorrow");
  assert.equal(slow.ok, false);
  assert.equal(slow.errors[0], "timeout");
  assert.equal(calls.length, 1);

  calls = [];
  stubFetch(() => json(429, { error: { message: "Rate limit reached" } }));
  assert.equal((await extractTripQuery("to Lisbon tomorrow")).errors[0], "rate_limited");
  assert.equal(calls.length, 1);

  calls = [];
  stubFetch(() => "hang");
  process.env.GROQ_TIMEOUT_MS = "5000";
  const visitor = new AbortController();
  setTimeout(() => visitor.abort(), 10);
  assert.equal((await extractTripQuery("to Lisbon tomorrow", { signal: visitor.signal })).errors[0], "cancelled");
  assert.equal(calls.length, 1);
});

test("Groq is asked a second time after any other failure", async () => {
  stubFetch(() => json(500, { error: { message: "Internal error" } }));
  assert.equal((await extractTripQuery("to Lisbon tomorrow")).errors[0], "failed_generation");
  assert.equal(calls.length, 2);
});

/** Runs a search and collects what it sends. */
async function search(signal?: AbortSignal) {
  const events: [string, { text?: string }][] = [];
  await runFlightSearch(
    { prompt: "to Lisbon tomorrow" },
    new Headers(),
    (event, data) => events.push([event, data as { text?: string }]),
    signal,
  );
  return events;
}

const groqAnswer = () =>
  json(200, {
    id: "x",
    model: "test",
    choices: [
      {
        index: 0,
        finish_reason: "stop",
        message: { role: "assistant", content: JSON.stringify({ origin_airport: "CPH", destination_airport: "LIS", departure_date: "2099-01-05" }) },
      },
    ],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  });

test("a slow provider ends the search with a message that says so", async () => {
  stubFetch(() => "hang");
  const groqSlow = await search();
  assert.match(groqSlow.at(-2)?.[1].text ?? "", /AI travel service is taking too long/);
  assert.equal(groqSlow.at(-1)?.[0], "done");

  stubFetch((url) => (url.includes("duffel") ? "hang" : groqAnswer()));
  const duffelSlow = await search();
  assert.match(duffelSlow.at(-2)?.[1].text ?? "", /flight search is taking too long/);
  assert.equal(duffelSlow.at(-1)?.[0], "done");
});

test("an abandoned search stops where it is and never reaches Duffel", async () => {
  process.env.GROQ_TIMEOUT_MS = "5000";
  process.env.DUFFEL_TIMEOUT_MS = "5000";

  // The visitor leaves while Groq is still working.
  stubFetch(() => "hang");
  let visitor = new AbortController();
  setTimeout(() => visitor.abort(), 350);
  let events = await search(visitor.signal);
  assert.deepEqual(events.map(([event]) => event), ["status"]);
  assert.equal(calls.filter((url) => url.includes("duffel")).length, 0);

  // The visitor leaves while Duffel is still working.
  calls = [];
  stubFetch((url) => (url.includes("duffel") ? "hang" : groqAnswer()));
  visitor = new AbortController();
  const leave = setInterval(() => calls.some((url) => url.includes("duffel")) && visitor.abort(), 20);
  events = await search(visitor.signal);
  clearInterval(leave);
  assert.equal(calls.filter((url) => url.includes("duffel")).length, 1);
  // No results, no error message, no `done`: nobody is listening.
  assert.ok(events.every(([event]) => event === "status" || event === "message"));
  assert.ok(!events.some(([, data]) => /too long|Error searching/.test(data.text ?? "")));
});

test("a question says what it is asking for, and keeps the destination", async () => {
  const groqReads = (query: Record<string, unknown>) =>
    stubFetch(() =>
      json(200, {
        id: "x",
        model: "test",
        choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(query) } }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
    );
  const lastEvent = async (prompt: string) => {
    const events: [string, unknown][] = [];
    await runFlightSearch({ prompt }, new Headers(), (event, data) => events.push([event, data]));
    return events.at(-1);
  };

  // A place but no date, as in "a beach holiday in Greece".
  groqReads({ destination_airport: "ATH" });
  assert.deepEqual(await lastEvent("a beach holiday"), [
    "done",
    { needsInput: true, asking: "departure_date", context: { destination: "ATH" } },
  ]);

  groqReads({ destination_airport: "ATH", departure_date: "2001-01-05" });
  assert.deepEqual(await lastEvent("a beach holiday in 2001"), [
    "done",
    { needsInput: true, asking: "departure_date", context: { destination: "ATH" } },
  ]);

  groqReads({ destination_airport: "ATH", departure_date: "2099-01-05", trip_type: "return" });
  assert.deepEqual(await lastEvent("a week away"), [
    "done",
    { needsInput: true, asking: "return_date", context: { destination: "ATH" } },
  ]);

  groqReads({});
  assert.deepEqual(await lastEvent("hello"), ["done", { needsInput: true, asking: "destination" }]);
});
