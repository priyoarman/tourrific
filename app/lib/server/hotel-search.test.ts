// Run with `npm test`. Groq, Duffel and the geocoder are replaced by a stand-in `fetch`, so nothing here uses the network.
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import type { StreamHotels } from "../types/stream-events";
import type { TripQuery } from "../types/trip-query";
import { clearSearchCache } from "./duffel.ts";
import { clearStaysCache } from "./duffel-stays.ts";
import { runFlightSearch } from "./flight-search-stream.ts";
import { searchHotels } from "./hotel-search.ts";
import { clearStayLocations } from "./stay-location.ts";

const realFetch = globalThis.fetch;
const realWarn = console.warn;
const realError = console.error;

type Answer = Response | "hang";
type Providers = { stays?: () => Answer; flights?: () => Answer; geocoder?: () => Answer; groq?: Record<string, unknown> };

let staysBodies: { data: Record<string, unknown> }[] = [];

const result = (id: string, total = "300.00") => ({
  id: `srr_${id}`,
  check_in_date: "2099-01-05",
  check_out_date: "2099-01-08",
  cheapest_rate_total_amount: total,
  cheapest_rate_currency: "EUR",
  accommodation: {
    id: `acc_${id}`,
    name: `Hotel ${id}`,
    rating: 4,
    review_score: 8.5,
    review_count: 120,
    location: { geographic_coordinates: { latitude: 38.72509, longitude: -9.1498 } },
  },
});
const stays = (...ids: string[]) => Response.json({ data: { results: ids.map((id) => result(id)) } });

/** Replaces `fetch`. Unless told otherwise: Lisbon is found, Duffel has one hotel and no flights, and Groq reads `groq`. */
function stubProviders({ stays: staysAnswer = () => stays("1"), flights, geocoder, groq = {} }: Providers = {}) {
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    let answer: Answer;
    if (url.includes("open-meteo")) {
      answer = geocoder?.() ?? Response.json({ results: [{ latitude: 38.72509, longitude: -9.1498, feature_code: "PPLC" }] });
    } else if (url.includes("/stays/")) {
      staysBodies.push(JSON.parse(String(init?.body)));
      answer = staysAnswer();
    } else if (url.includes("duffel")) {
      answer = flights?.() ?? Response.json({ data: { offers: [] } });
    } else {
      answer = Response.json({
        id: "x",
        model: "test",
        choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(groq) } }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      });
    }
    if (answer !== "hang") return Promise.resolve(answer);
    // Like the real thing, a request that is waiting ends when its signal is aborted.
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    });
  }) as typeof fetch;
}

const trip = (changes: Partial<TripQuery> = {}) =>
  ({ destination_airport: "LIS", departure_date: "2099-01-05", return_date: "2099-01-08", passengers: null, ...changes }) as TripQuery;

beforeEach(() => {
  staysBodies = [];
  clearSearchCache();
  clearStaysCache();
  clearStayLocations();
  console.warn = () => {};
  console.error = () => {};
  process.env.GROQ_API_KEY = "test";
  process.env.DUFFEL_TOKEN = "test";
  delete process.env.DUFFEL_USE_MOCK;
  delete process.env.DUFFEL_TIMEOUT_MS;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  console.warn = realWarn;
  console.error = realError;
  delete process.env.DUFFEL_TIMEOUT_MS;
  delete process.env.DUFFEL_USE_MOCK;
});

test("hotels are searched for the place, nights and travellers of the trip", async () => {
  stubProviders({ stays: () => stays("1", "2") });

  const found = await searchHotels(trip({ passengers: 3 }), "LIS");

  assert.deepEqual(staysBodies, [
    {
      data: {
        location: { radius: 5, geographic_coordinates: { latitude: 38.72509, longitude: -9.1498 } },
        check_in_date: "2099-01-05",
        check_out_date: "2099-01-08",
        guests: [{ type: "adult" }, { type: "adult" }, { type: "adult" }],
        // Two to a room.
        rooms: 2,
      },
    },
  ]);
  assert.deepEqual(found?.stay, {
    city: "Lisbon",
    around: "city",
    checkIn: "2099-01-05",
    checkOut: "2099-01-08",
    nights: 3,
    nightsAssumed: false,
    guests: 3,
    rooms: 2,
  });
  assert.equal(found?.totalHotels, 2);
  assert.equal(found?.failed, undefined);
  assert.deepEqual(found?.hotels.map((hotel) => [hotel.id, hotel.name, hotel.nightlyPrice, hotel.currency, hotel.distanceKm]), [
    ["acc_1", "Hotel 1", 100, "EUR", 0],
    ["acc_2", "Hotel 2", 100, "EUR", 0],
  ]);
});

test("what was asked of the hotel is sent to Duffel where it can be, and filtered here where it can't", async () => {
  const hotel = (id: string, stars: number | null, total: string, amenities: string[]) => {
    const found = result(id, total);
    return { ...found, accommodation: { ...found.accommodation, rating: stars, amenities: amenities.map((type) => ({ type, description: type })) } };
  };
  stubProviders({
    stays: () =>
      Response.json({
        data: {
          results: [
            hotel("cheap", 3, "240.00", ["wifi", "pool"]),
            hotel("fits", 4, "420.00", ["wifi", "pool", "spa", "gym", "parking"]),
            hotel("dear", 5, "900.00", ["wifi", "pool", "parking"]),
            hotel("dry", 4, "300.00", ["wifi", "parking"]),
            hotel("unrated", null, "300.00", ["pool", "parking"]),
          ],
        },
      }),
  });

  const found = await searchHotels(
    trip({ passengers: 2, hotel_rooms: 2, hotel_min_stars: 4, hotel_max_price: 150, hotel_max_price_currency: "EUR", hotel_free_cancellation: true, hotel_amenities: ["pool", "parking"] }),
    "LIS",
  );

  assert.equal(staysBodies[0].data.rooms, 2);
  assert.equal(staysBodies[0].data.free_cancellation_only, true);

  // Three nights each: 80, 140, 300, 100 and 100 a night.
  assert.deepEqual(found?.hotels.map((hotel) => hotel.id), ["acc_fits"]);
  assert.equal(found?.totalHotels, 1);
  assert.deepEqual(found?.filters, {
    labels: ["4+ stars", "Pool", "Parking", "Free cancellation", "Under €150 a night", "2 rooms"],
    unfilteredCount: 5,
  });
  // The card shows it has what was asked for, and that it can be cancelled.
  assert.deepEqual(found?.hotels[0].amenities, ["Pool", "Parking", "Wi-Fi"]);
  assert.equal(found?.hotels[0].freeCancellation, true);
  assert.equal(found?.stay.rooms, 2);
});

test("a one-way trip is given a few nights, and says they are a guess", async () => {
  stubProviders();

  const found = await searchHotels(trip({ return_date: null }), "LIS");
  assert.equal(found?.stay.checkOut, "2099-01-08");
  assert.equal(found?.stay.nights, 3);
  assert.equal(found?.stay.nightsAssumed, true);
  assert.equal(staysBodies[0].data.check_out_date, "2099-01-08");
});

test("nothing is searched when there is no stay to search", async () => {
  stubProviders();

  // Back the same day, away for longer than Duffel searches, no date, and nowhere known.
  assert.equal(await searchHotels(trip({ return_date: "2099-01-05" }), "LIS"), null);
  assert.equal(await searchHotels(trip({ return_date: "2099-06-05" }), "LIS"), null);
  assert.equal(await searchHotels(trip({ departure_date: null }), "LIS"), null);
  assert.equal(await searchHotels(trip(), "ZZZZ"), null);
  assert.equal(staysBodies.length, 0);
});

test("only the first hotels are sent, with how many there were", async () => {
  stubProviders({ stays: () => stays(...Array.from({ length: 45 }, (_, i) => String(i))) });

  const found = await searchHotels(trip(), "LIS");
  assert.equal(found?.hotels.length, 30);
  assert.equal(found?.hotels[0].id, "acc_0");
  assert.equal(found?.totalHotels, 45);
});

test("without the city centre, hotels are searched around the airport and carry no distance", async () => {
  stubProviders({ geocoder: () => new Response("down", { status: 503 }) });

  const found = await searchHotels(trip(), "LIS");
  assert.equal(found?.stay.around, "airport");
  assert.deepEqual(staysBodies[0].data.location, { radius: 25, geographic_coordinates: { latitude: 38.7813, longitude: -9.13592 } });
  assert.equal(found?.hotels[0].distanceKm, null);
});

test("a hotel search that fails says so and has no hotels", async () => {
  const failed = { hotels: [], totalHotels: 0, failed: true };
  const outcome = async (signal?: AbortSignal) => {
    const found = await searchHotels(trip(), "LIS", signal);
    return { hotels: found?.hotels, totalHotels: found?.totalHotels, failed: found?.failed };
  };

  // What Duffel answers until Stays is switched on for the account.
  stubProviders({ stays: () => Response.json({ errors: [{ message: "This feature is not enabled for your account." }] }, { status: 403 }) });
  assert.deepEqual(await outcome(), failed);

  process.env.DUFFEL_TIMEOUT_MS = "30";
  stubProviders({ stays: () => "hang" });
  assert.deepEqual(await outcome(), failed);

  process.env.DUFFEL_TIMEOUT_MS = "5000";
  const visitor = new AbortController();
  setTimeout(() => visitor.abort(), 10);
  assert.deepEqual(await outcome(visitor.signal), failed);
});

test("with DUFFEL_USE_MOCK, a failed hotel search answers with sample hotels that say what they are", async () => {
  process.env.DUFFEL_USE_MOCK = "true";
  stubProviders({ stays: () => Response.json({ errors: [{ message: "This feature is not enabled for your account." }] }, { status: 403 }) });

  const found = await searchHotels(trip(), "LIS");
  assert.equal(found?.sample, true);
  assert.equal(found?.failed, undefined);
  assert.equal(found?.hotels.length, 6);
  assert.equal(found?.totalHotels, 6);
  assert.equal(found?.stay.nights, 3);
  assert.ok(found?.hotels.every((hotel) => hotel.id.startsWith("LIS-hotel-") && hotel.currency === "USD" && hotel.photoUrl === null));
  // The same place gets the same hotels every time.
  assert.deepEqual((await searchHotels(trip(), "LIS"))?.hotels, found?.hotels);

  // Real hotels are never marked, and the sample ones are never kept in their place.
  stubProviders({ stays: () => stays("1") });
  const real = await searchHotels(trip(), "LIS");
  assert.equal(real?.sample, undefined);
  assert.deepEqual(real?.hotels.map((hotel) => hotel.id), ["acc_1"]);

  // A visitor who left gets nothing made up for them.
  stubProviders({ stays: () => "hang" });
  clearStaysCache();
  const visitor = new AbortController();
  setTimeout(() => visitor.abort(), 10);
  assert.equal((await searchHotels(trip(), "LIS", visitor.signal))?.failed, true);
});

/** Runs a chat search for a return trip to Lisbon and collects what it sends. */
async function chatSearch(body: Record<string, unknown> = {}) {
  const events: [string, unknown][] = [];
  await runFlightSearch({ prompt: "Copenhagen to Lisbon", ...body }, new Headers(), (event, data) => events.push([event, data]));
  return events;
}
const names = (events: [string, unknown][]) => events.map(([event]) => event).filter((event) => event !== "status");
const READS = { origin_airport: "CPH", destination_airport: "LIS", departure_date: "2099-01-05", return_date: "2099-01-08", passengers: 2 };

test("a chat search sends the hotels after the flights", async () => {
  stubProviders({ groq: READS, stays: () => stays("1", "2") });

  const events = await chatSearch();
  assert.deepEqual(names(events), ["complete", "hotels", "done"]);

  const hotels = events.find(([event]) => event === "hotels")?.[1] as StreamHotels;
  assert.equal(hotels.hotels.length, 2);
  assert.equal(hotels.stay.city, "Lisbon");
  assert.equal(hotels.stay.guests, 2);
  assert.equal(hotels.stay.rooms, 1);
});

test("a failed hotel search leaves the flights as they are", async () => {
  stubProviders({ groq: READS, stays: () => new Response("down", { status: 503 }) });

  const events = await chatSearch();
  assert.deepEqual(names(events), ["complete", "hotels", "done"]);
  assert.equal((events.find(([event]) => event === "hotels")?.[1] as StreamHotels).failed, true);
});

test("a failed flight search sends no hotels", async () => {
  // The hotels are still on their way when the flights fail, and are dropped.
  stubProviders({ groq: READS, flights: () => new Response("down", { status: 503 }), stays: () => "hang" });
  process.env.DUFFEL_TIMEOUT_MS = "5000";

  const started = Date.now();
  const events = await chatSearch();
  assert.deepEqual(names(events), ["message", "done"]);
  assert.ok(Date.now() - started < 4000);
});

test("hotels are sent with the first page of flights only, and not for a day trip", async () => {
  stubProviders({ groq: READS });
  assert.deepEqual(names(await chatSearch({ page: 2 })), ["complete", "done"]);

  stubProviders({ groq: { ...READS, return_date: "2099-01-05" } });
  assert.deepEqual(names(await chatSearch()), ["complete", "done"]);
  assert.equal(staysBodies.length, 0);
});
