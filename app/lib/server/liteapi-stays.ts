// Searches hotels with LiteAPI (https://docs.liteapi.travel), which gives out a
// sandbox key on sign-up. Its answer is turned into the shape of a Duffel Stays
// answer, so the hotel filters and cards work the same with either.
//
// Written from LiteAPI's API reference, not from a recorded answer. Check it
// against a real one.
import type { DuffelStaysResult } from "../types/duffel-stays";
import type { HotelAmenity } from "../types/trip-query";
import { AMENITY_LABELS } from "../duffel-to-hotel.ts";
import { cacheTtlMs } from "./duffel.ts";
import { staysCacheKey, type DuffelStaysResponse, type DuffelStaysSearch } from "./duffel-stays.ts";
import { createTtlCache } from "./ttl-cache.ts";

const API_URL = "https://api.liteapi.travel/v3.0";
const DEFAULT_TIMEOUT_MS = 20_000;
/** Prices are asked for in this currency unless LITEAPI_CURRENCY names another. */
const DEFAULT_CURRENCY = "EUR";
/** LiteAPI wants to know where the guests are from; rates can differ by country. */
const GUEST_NATIONALITY = "US";
/** Seconds LiteAPI spends collecting rates before answering with what it has. */
const SUPPLIER_TIMEOUT_SECONDS = 10;
/** LiteAPI's code for a search that found no rooms. */
const NO_AVAILABILITY = 2001;

/** LiteAPI didn't answer in time. */
export class LiteApiTimeout extends Error {
  constructor() {
    super("LiteAPI took too long to answer.");
    this.name = "LiteApiTimeout";
  }
}

type Money = { amount: number; currency: string };

/** The rates found for one hotel. Asked for one offer per hotel: the cheapest. */
type LiteApiHotelRates = {
  hotelId: string;
  roomTypes?:
    | {
        /** What the offer costs for the whole stay and every room. */
        offerRetailRate?: Money[] | Money | null;
        rates?:
          | {
              cancellationPolicies?: {
                cancelPolicyInfos?: { cancelTime?: string | null }[] | null;
                /** "RFN" when the money comes back if cancelled in time, "NRFN" when it doesn't. */
                refundableTag?: string | null;
              } | null;
            }[]
          | null;
      }[]
    | null;
};

/** What `includeHotelData` adds about each hotel. */
type LiteApiHotel = {
  id: string;
  name: string;
  main_photo?: string | null;
  address?: string | null;
  city_name?: string | null;
  country_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  /** What guests gave it, out of 10. */
  rating?: number | null;
  /** 1 to 5, halves included. */
  stars?: number | null;
  review_count?: number | null;
};

type LiteApiRatesAnswer = {
  data?: LiteApiHotelRates[] | null;
  hotels?: LiteApiHotel[] | null;
  error?: { code?: number; message?: string } | null;
};

/**
 * Sends a request to a LiteAPI endpoint such as "/hotels/rates" and returns the
 * answer as text, whatever its status. Throws LiteApiTimeout when `timeout` runs out.
 */
async function askLiteApi(path: string, init: RequestInit, timeout: AbortSignal, signal?: AbortSignal) {
  // Read per call, so a changed .env.local is picked up without a restart.
  const key = process.env.LITEAPI_KEY;
  if (!key) throw new Error("Missing LiteAPI key in LITEAPI_KEY.");

  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "X-API-Key": key, Accept: "application/json", ...init.headers },
      cache: "no-store",
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    return { ok: response.ok, text: await response.text() };
  } catch (error) {
    // The visitor leaving is not a timeout, even if both happen at once.
    throw timeout.aborted && !signal?.aborted ? new LiteApiTimeout() : error;
  }
}

/** The same, for a GET whose answer is `{ data: [...] }`. Throws when LiteAPI refuses. */
async function listFromLiteApi<Row>(path: string, timeout: AbortSignal, signal?: AbortSignal): Promise<Row[]> {
  const { ok, text } = await askLiteApi(path, { method: "GET" }, timeout, signal);
  if (!ok) throw new Error(text);
  return (JSON.parse(text) as { data?: Row[] | null }).data ?? [];
}

// LiteAPI names hundreds of facilities ("Outdoor swimming pool", "Free WiFi").
// These are the ones a visitor can ask for, found by name.
const AMENITY_NAMES: [HotelAmenity, RegExp][] = [
  ["wifi", /wi-?fi|internet/i],
  ["pool", /\bpool\b(?! table)/i],
  ["spa", /\bspa\b/i],
  ["gym", /fitness|\bgym\b/i],
  ["parking", /parking/i],
  ["restaurant", /restaurant/i],
  ["room_service", /room service/i],
  ["pet_friendly", /pets? (allowed|friendly)/i],
];

/** The amenity a facility called `name` counts as, if any. */
export function amenityNamed(name: string): HotelAmenity | null {
  return AMENITY_NAMES.find(([, pattern]) => pattern.test(name))?.[0] ?? null;
}

// Facility ids don't change, so the list is asked for once and kept for good.
let amenityByFacility: Map<number, HotelAmenity> | null = null;

async function facilityAmenities(timeout: AbortSignal, signal?: AbortSignal) {
  if (amenityByFacility) return amenityByFacility;

  const facilities = await listFromLiteApi<{ facility_id: number; facility: string }>("/data/facilities", timeout, signal);
  const found = new Map<number, HotelAmenity>();
  for (const { facility_id, facility } of facilities) {
    const amenity = amenityNamed(String(facility));
    if (amenity) found.set(facility_id, amenity);
  }
  return (amenityByFacility = found);
}

/**
 * What each of `hotelIds` has, of the amenities a visitor can ask for. A rates
 * search doesn't say, so the hotels are looked up again for their facilities.
 *
 * Never throws. When the lookup fails the hotels are simply listed without amenities.
 */
async function amenitiesOf(hotelIds: string[], timeout: AbortSignal, signal?: AbortSignal) {
  const amenities = new Map<string, HotelAmenity[]>();
  if (!hotelIds.length) return amenities;

  try {
    const query = new URLSearchParams({ hotelIds: hotelIds.join(","), limit: String(hotelIds.length) });
    const [byFacility, hotels] = await Promise.all([
      facilityAmenities(timeout, signal),
      listFromLiteApi<{ id: string; facilityIds?: number[] | null }>(`/data/hotels?${query}`, timeout, signal),
    ]);
    for (const { id, facilityIds } of hotels) {
      const has = (facilityIds ?? []).flatMap((facility) => byFacility.get(facility) ?? []);
      amenities.set(id, [...new Set(has)]);
    }
  } catch (error) {
    if (!signal?.aborted) {
      console.warn("Could not look up hotel amenities:", error instanceof Error ? error.message : error);
    }
  }
  return amenities;
}

/** One room per entry, with the guests spread as evenly as they go. */
function occupancies(guests: number, rooms: number) {
  return Array.from({ length: rooms }, (_, room) => ({
    adults: Math.floor(guests / rooms) + (room < guests % rooms ? 1 : 0),
  }));
}

/** The cheapest offer of a hotel as Duffel would have described it. Null when the hotel has no priced offer. */
function toStaysResult(
  rates: LiteApiHotelRates,
  hotel: LiteApiHotel,
  search: DuffelStaysSearch,
  amenities: HotelAmenity[],
): DuffelStaysResult | null {
  const offers = (rates.roomTypes ?? []).flatMap((offer) => {
    const price = Array.isArray(offer.offerRetailRate) ? offer.offerRetailRate[0] : offer.offerRetailRate;
    return price && Number.isFinite(price.amount) ? [{ offer, price }] : [];
  });
  if (!offers.length) return null;

  const { offer, price } = offers.reduce((cheapest, next) => (next.price.amount < cheapest.price.amount ? next : cheapest));
  const total = price.amount.toFixed(2);
  const roomRates = offer.rates ?? [];
  // An offer for several rooms is only free to cancel when every room is.
  const refundable = roomRates.length > 0 && roomRates.every((rate) => rate.cancellationPolicies?.refundableTag === "RFN");
  const until = roomRates[0]?.cancellationPolicies?.cancelPolicyInfos?.[0]?.cancelTime ?? search.check_in_date;

  const hasPosition = typeof hotel.latitude === "number" && typeof hotel.longitude === "number";
  return {
    id: rates.hotelId,
    check_in_date: search.check_in_date,
    check_out_date: search.check_out_date,
    cheapest_rate_total_amount: total,
    cheapest_rate_currency: price.currency,
    accommodation: {
      id: hotel.id,
      name: hotel.name,
      rating: hotel.stars || null,
      review_score: hotel.rating || null,
      review_count: hotel.review_count ?? null,
      photos: hotel.main_photo ? [{ url: hotel.main_photo }] : [],
      amenities: amenities.map((type) => ({ type, description: AMENITY_LABELS[type] })),
      location: {
        address: { line_one: hotel.address, city_name: hotel.city_name, country_code: hotel.country_code },
        geographic_coordinates: hasPosition ? { latitude: hotel.latitude!, longitude: hotel.longitude! } : null,
      },
      rooms: [
        {
          rates: [
            {
              total_amount: total,
              total_currency: price.currency,
              cancellation_timeline: refundable ? [{ before: until, refund_amount: total, currency: price.currency }] : [],
            },
          ],
        },
      ],
    },
  };
}

/**
 * Asks LiteAPI for hotels, and answers the way Duffel Stays would have: one
 * result per hotel, with its cheapest rate.
 *
 * Throws LiteApiTimeout when LiteAPI takes too long. Aborting `signal` (the
 * visitor is no longer waiting) drops the request and throws an AbortError.
 */
export async function searchLiteApiStays(search: DuffelStaysSearch, signal?: AbortSignal): Promise<DuffelStaysResponse> {
  // One clock for the search and the amenity lookup after it.
  const timeout = AbortSignal.timeout(Number(process.env.LITEAPI_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS);
  const { latitude, longitude } = search.location.geographic_coordinates;

  const { ok, text } = await askLiteApi(
    "/hotels/rates",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        latitude,
        longitude,
        // LiteAPI measures in metres.
        radius: search.location.radius * 1000,
        checkin: search.check_in_date,
        checkout: search.check_out_date,
        currency: process.env.LITEAPI_CURRENCY || DEFAULT_CURRENCY,
        guestNationality: GUEST_NATIONALITY,
        occupancies: occupancies(search.guests.length, search.rooms),
        includeHotelData: true,
        maxRatesPerHotel: 1,
        timeout: SUPPLIER_TIMEOUT_SECONDS,
        ...(search.free_cancellation_only && { refundableRatesOnly: true }),
      }),
    },
    timeout,
    signal,
  );

  let answer: LiteApiRatesAnswer;
  try {
    answer = JSON.parse(text);
  } catch {
    throw new Error(text);
  }
  // Finding nothing is an error to LiteAPI, but an empty list here.
  if (answer.error?.code === NO_AVAILABILITY) return { data: { results: [] } };
  if (!ok || answer.error) throw new Error(text);

  const hotels = new Map((answer.hotels ?? []).map((hotel) => [hotel.id, hotel]));
  const priced = (answer.data ?? []).filter((rates) => hotels.has(rates.hotelId));
  const amenities = await amenitiesOf(priced.map((rates) => rates.hotelId), timeout, signal);

  const results = priced.flatMap(
    (rates) => toStaysResult(rates, hotels.get(rates.hotelId)!, search, amenities.get(rates.hotelId) ?? []) ?? [],
  );
  return { data: { results } };
}

// Kept as text like the Duffel answers, and for as long (DUFFEL_CACHE_MINUTES).
const cache = createTtlCache({ maxEntries: 50, maxSize: 20_000_000 });

/**
 * The same as searchLiteApiStays, but a search LiteAPI answered in the last few
 * minutes is answered from memory instead of asking again. A failure is never kept.
 */
export async function searchLiteApiStaysCached(search: DuffelStaysSearch, signal?: AbortSignal): Promise<DuffelStaysResponse> {
  const key = `${process.env.LITEAPI_CURRENCY || DEFAULT_CURRENCY}:${staysCacheKey(search)}`;
  // Parsed afresh for each caller, so nobody can change what the next one gets.
  const kept = cache.get(key);
  if (kept) return JSON.parse(kept);

  const answer = await searchLiteApiStays(search, signal);
  cache.set(key, JSON.stringify(answer), cacheTtlMs());
  return answer;
}

/** Forgets every kept answer and the facility list. For tests. */
export function clearLiteApiCache() {
  cache.clear();
  amenityByFacility = null;
}
