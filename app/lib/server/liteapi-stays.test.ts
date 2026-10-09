// Run with `npm test`. LiteAPI and the geocoder are replaced by a stand-in `fetch`, so nothing here uses the network.
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import type { TripQuery } from "../types/trip-query";
import type { DuffelStaysSearch } from "./duffel-stays.ts";
import { searchHotels } from "./hotel-search.ts";
import { amenityNamed, clearLiteApiCache, LiteApiTimeout, searchLiteApiStays, searchLiteApiStaysCached } from "./liteapi-stays.ts";
import { clearStayLocations } from "./stay-location.ts";

const realFetch = globalThis.fetch;
const realWarn = console.warn;

type Answer = Response | "hang";
type LiteApi = { rates?: () => Answer; facilities?: () => Answer; hotels?: () => Answer };

let calls: { url: string; init?: RequestInit }[] = [];
const callsTo = (path: string) => calls.filter((call) => call.url.includes(path));

const offer = (amount: number, tag = "NRFN") => ({
  offerRetailRate: [{ amount, currency: "EUR" }],
  rates: [{ cancellationPolicies: { cancelPolicyInfos: [{ cancelTime: "2099-01-03 12:00:00" }], refundableTag: tag } }],
});
const hotelRates = (id: string, ...offers: unknown[]) => ({ hotelId: id, roomTypes: offers.length ? offers : [offer(300)] });
const hotel = (id: string) => ({
  id,
  name: `Hotel ${id}`,
  main_photo: `https://photos.example/${id}.jpg`,
  address: "Rua Augusta 1",
  city_name: "Lisbon",
  country_code: "PT",
  latitude: 38.72509,
  longitude: -9.1498,
  rating: 8.5,
  stars: 4,
  review_count: 120,
});
const found = (...ids: string[]) => Response.json({ data: ids.map((id) => hotelRates(id)), hotels: ids.map(hotel) });

const facilities = () =>
  Response.json({
    data: [
      { facility_id: 1, facility: "Outdoor swimming pool" },
      { facility_id: 2, facility: "Free WiFi" },
      { facility_id: 3, facility: "Farming classes" },
      { facility_id: 4, facility: "Indoor pool" },
    ],
  });

/** Replaces `fetch`. Unless told otherwise: LiteAPI has one hotel, with a pool and Wi-Fi, and Lisbon is found. */
function stubLiteApi({ rates = () => found("lp1"), facilities: facilityList = facilities, hotels }: LiteApi = {}) {
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    let answer: Answer;
    if (url.includes("open-meteo")) {
      answer = Response.json({ results: [{ latitude: 38.72509, longitude: -9.1498, feature_code: "PPLC" }] });
    } else if (url.includes("/hotels/rates")) {
      answer = rates();
    } else if (url.includes("/data/facilities")) {
      answer = facilityList();
    } else if (url.includes("/data/hotels")) {
      const ids = new URL(url).searchParams.get("hotelIds")?.split(",") ?? [];
      answer = hotels?.() ?? Response.json({ data: ids.map((id) => ({ id, facilityIds: [1, 2, 3, 4] })) });
    } else {
      throw new Error(`Unexpected request to ${url}`);
    }
    if (answer !== "hang") return Promise.resolve(answer);
    // Like the real thing, a request that is waiting ends when its signal is aborted.
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    });
  }) as typeof fetch;
}

const search = (changes: Partial<DuffelStaysSearch> = {}): DuffelStaysSearch => ({
  location: { radius: 5, geographic_coordinates: { latitude: 38.7223, longitude: -9.1393 } },
  check_in_date: "2099-01-05",
  check_out_date: "2099-01-08",
  guests: [{ type: "adult" }],
  rooms: 1,
  ...changes,
});

beforeEach(() => {
  calls = [];
  clearLiteApiCache();
  clearStayLocations();
  console.warn = () => {};
  process.env.LITEAPI_KEY = "sand_test";
  delete process.env.LITEAPI_CURRENCY;
  delete process.env.LITEAPI_TIMEOUT_MS;
  delete process.env.DUFFEL_CACHE_MINUTES;
  delete process.env.DUFFEL_USE_MOCK;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  console.warn = realWarn;
  delete process.env.LITEAPI_KEY;
  delete process.env.LITEAPI_CURRENCY;
  delete process.env.LITEAPI_TIMEOUT_MS;
});

test("a search is posted to LiteAPI the way it expects", async () => {
  stubLiteApi();

  await searchLiteApiStays(search({ guests: [{ type: "adult" }, { type: "adult" }, { type: "adult" }], rooms: 2 }));

  const [{ url, init }] = callsTo("/hotels/rates");
  assert.equal(url, "https://api.liteapi.travel/v3.0/hotels/rates");
  assert.equal(init?.method, "POST");
  const headers = init?.headers as Record<string, string>;
  assert.equal(headers["X-API-Key"], "sand_test");
  assert.equal(headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(String(init?.body)), {
    latitude: 38.7223,
    longitude: -9.1393,
    radius: 5000,
    checkin: "2099-01-05",
    checkout: "2099-01-08",
    currency: "EUR",
    guestNationality: "US",
    occupancies: [{ adults: 2 }, { adults: 1 }],
    includeHotelData: true,
    maxRatesPerHotel: 1,
    timeout: 10,
  });
});

test("free cancellation and another currency are asked of LiteAPI", async () => {
  stubLiteApi();
  process.env.LITEAPI_CURRENCY = "USD";

  await searchLiteApiStays(search({ free_cancellation_only: true }));

  const body = JSON.parse(String(callsTo("/hotels/rates")[0].init?.body));
  assert.equal(body.refundableRatesOnly, true);
  assert.equal(body.currency, "USD");
});

test("a hotel comes back in the shape of a Duffel Stays result, at its cheapest offer", async () => {
  stubLiteApi({
    rates: () => Response.json({ data: [hotelRates("lp1", offer(450, "RFN"), offer(300))], hotels: [hotel("lp1")] }),
  });

  const answer = await searchLiteApiStays(search());

  assert.deepEqual(answer, {
    data: {
      results: [
        {
          id: "lp1",
          check_in_date: "2099-01-05",
          check_out_date: "2099-01-08",
          cheapest_rate_total_amount: "300.00",
          cheapest_rate_currency: "EUR",
          accommodation: {
            id: "lp1",
            name: "Hotel lp1",
            rating: 4,
            review_score: 8.5,
            review_count: 120,
            photos: [{ url: "https://photos.example/lp1.jpg" }],
            amenities: [
              { type: "pool", description: "Pool" },
              { type: "wifi", description: "Wi-Fi" },
            ],
            location: {
              address: { line_one: "Rua Augusta 1", city_name: "Lisbon", country_code: "PT" },
              geographic_coordinates: { latitude: 38.72509, longitude: -9.1498 },
            },
            rooms: [{ rates: [{ total_amount: "300.00", total_currency: "EUR", cancellation_timeline: [] }] }],
          },
        },
      ],
    },
  });
});

test("an offer that can be cancelled for free says until when", async () => {
  stubLiteApi({ rates: () => Response.json({ data: [hotelRates("lp1", offer(300, "RFN"))], hotels: [hotel("lp1")] }) });

  const answer = await searchLiteApiStays(search());

  assert.deepEqual(answer.data?.results?.[0].accommodation.rooms?.[0].rates?.[0].cancellation_timeline, [
    { before: "2099-01-03 12:00:00", refund_amount: "300.00", currency: "EUR" },
  ]);
});

test("a hotel without a price or without details is left out", async () => {
  stubLiteApi({
    rates: () =>
      Response.json({
        data: [hotelRates("lp1"), { hotelId: "lp2", roomTypes: [] }, hotelRates("lp3")],
        hotels: [hotel("lp1"), hotel("lp2")],
      }),
  });

  const answer = await searchLiteApiStays(search());

  assert.deepEqual(answer.data?.results?.map((result) => result.id), ["lp1"]);
});

test("a search that finds no rooms is an empty list, not a failure", async () => {
  stubLiteApi({ rates: () => Response.json({ error: { code: 2001, message: "no availability found" } }, { status: 404 }) });

  assert.deepEqual(await searchLiteApiStays(search()), { data: { results: [] } });
  assert.equal(callsTo("/data/").length, 0);
});

test("a search LiteAPI refuses fails with its answer", async () => {
  stubLiteApi({ rates: () => Response.json({ error: { code: 4002, message: "invalid API key" } }, { status: 401 }) });

  await assert.rejects(searchLiteApiStays(search()), /invalid API key/);
});

test("a search without a key fails before anything is sent", async () => {
  stubLiteApi();
  delete process.env.LITEAPI_KEY;

  await assert.rejects(searchLiteApiStays(search()), /LITEAPI_KEY/);
  assert.equal(calls.length, 0);
});

test("a failed amenity lookup costs the amenities, not the hotels", async () => {
  stubLiteApi({ hotels: () => new Response("down", { status: 500 }) });

  const answer = await searchLiteApiStays(search());

  assert.deepEqual(answer.data?.results?.map((result) => [result.id, result.accommodation.amenities]), [["lp1", []]]);
});

test("the facility list is asked for once", async () => {
  stubLiteApi();

  await searchLiteApiStays(search());
  await searchLiteApiStays(search());

  assert.equal(callsTo("/data/facilities").length, 1);
  assert.equal(callsTo("/data/hotels").length, 2);
});

test("facilities are matched to amenities by name", () => {
  assert.equal(amenityNamed("Outdoor swimming pool"), "pool");
  assert.equal(amenityNamed("Pool table"), null);
  assert.equal(amenityNamed("WiFi available in all areas"), "wifi");
  assert.equal(amenityNamed("Spa and wellness centre"), "spa");
  assert.equal(amenityNamed("Fitness centre"), "gym");
  assert.equal(amenityNamed("Free parking"), "parking");
  assert.equal(amenityNamed("Room service"), "room_service");
  assert.equal(amenityNamed("Pets allowed"), "pet_friendly");
  assert.equal(amenityNamed("Farming classes"), null);
});

test("LiteAPI taking too long is a timeout", async () => {
  stubLiteApi({ rates: () => "hang" });
  process.env.LITEAPI_TIMEOUT_MS = "20";

  await assert.rejects(searchLiteApiStays(search()), LiteApiTimeout);
});

test("a visitor who leaves is not a timeout", async () => {
  stubLiteApi({ rates: () => "hang" });
  const leaving = new AbortController();

  const pending = searchLiteApiStays(search(), leaving.signal);
  leaving.abort();

  await assert.rejects(pending, { name: "AbortError" });
});

test("the same search is answered from memory, a failed one is not kept", async () => {
  let fail = true;
  stubLiteApi({ rates: () => (fail ? new Response("down", { status: 500 }) : found("lp1")) });

  await assert.rejects(searchLiteApiStaysCached(search()));
  fail = false;
  const first = await searchLiteApiStaysCached(search());
  const second = await searchLiteApiStaysCached(search());

  assert.deepEqual(second, first);
  assert.equal(callsTo("/hotels/rates").length, 2);
});

test("with a LiteAPI key, the hotels of a trip come from LiteAPI", async () => {
  stubLiteApi({ rates: () => found("lp1", "lp2") });
  const trip = { destination_airport: "LIS", departure_date: "2099-01-05", return_date: "2099-01-08", passengers: 2, hotel_amenities: ["pool"] };

  const answer = await searchHotels(trip as TripQuery, "LIS");

  assert.equal(answer?.failed, undefined);
  assert.deepEqual(
    answer?.hotels.map(({ id, name, nightlyPrice, currency, stars, rating, distanceKm, amenities, photoUrl }) => ({
      id, name, nightlyPrice, currency, stars, rating, distanceKm, amenities, photoUrl,
    })),
    ["lp1", "lp2"].map((id) => ({
      id,
      name: `Hotel ${id}`,
      nightlyPrice: 100,
      currency: "EUR",
      stars: 4,
      rating: 8.5,
      distanceKm: 0,
      amenities: ["Pool", "Wi-Fi"],
      photoUrl: `https://photos.example/${id}.jpg`,
    })),
  );
  assert.equal(calls.some((call) => call.url.includes("duffel")), false);
});
