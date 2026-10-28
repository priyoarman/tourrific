import type { DuffelStaysResult } from "../types/duffel-stays";
import type { HotelAmenity } from "../types/trip-query";
import { AMENITY_LABELS } from "../duffel-to-hotel.ts";
import { cacheTtlMs } from "./duffel.ts";
import { staysCacheKey, type DuffelStaysResponse, type DuffelStaysSearch } from "./duffel-stays.ts";
import { createTtlCache } from "./ttl-cache.ts";

const API_URL = "https://api.liteapi.travel/v3.0";
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_CURRENCY = "EUR";
const GUEST_NATIONALITY = "US";
const SUPPLIER_TIMEOUT_SECONDS = 10;
const NO_AVAILABILITY = 2001;

export class LiteApiTimeout extends Error {
  constructor() {
    super("LiteAPI took too long to answer.");
    this.name = "LiteApiTimeout";
  }
}

type Money = { amount: number; currency: string };

type LiteApiHotelRates = {
  hotelId: string;
  roomTypes?:
    | {
        offerRetailRate?: Money[] | Money | null;
        rates?:
          | {
              cancellationPolicies?: {
                cancelPolicyInfos?: { cancelTime?: string | null }[] | null;
                refundableTag?: string | null;
              } | null;
            }[]
          | null;
      }[]
    | null;
};

type LiteApiHotel = {
  id: string;
  name: string;
  main_photo?: string | null;
  address?: string | null;
  city_name?: string | null;
  country_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  rating?: number | null;
  stars?: number | null;
  review_count?: number | null;
};

type LiteApiRatesAnswer = {
  data?: LiteApiHotelRates[] | null;
  hotels?: LiteApiHotel[] | null;
  error?: { code?: number; message?: string } | null;
};

async function askLiteApi(path: string, init: RequestInit, timeout: AbortSignal, signal?: AbortSignal) {
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
    throw timeout.aborted && !signal?.aborted ? new LiteApiTimeout() : error;
  }
}

async function listFromLiteApi<Row>(path: string, timeout: AbortSignal, signal?: AbortSignal): Promise<Row[]> {
  const { ok, text } = await askLiteApi(path, { method: "GET" }, timeout, signal);
  if (!ok) throw new Error(text);
  return (JSON.parse(text) as { data?: Row[] | null }).data ?? [];
}

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

export function amenityNamed(name: string): HotelAmenity | null {
  return AMENITY_NAMES.find(([, pattern]) => pattern.test(name))?.[0] ?? null;
}

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

function occupancies(guests: number, rooms: number) {
  return Array.from({ length: rooms }, (_, room) => ({
    adults: Math.floor(guests / rooms) + (room < guests % rooms ? 1 : 0),
  }));
}

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

export async function searchLiteApiStays(search: DuffelStaysSearch, signal?: AbortSignal): Promise<DuffelStaysResponse> {
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

const cache = createTtlCache({ maxEntries: 50, maxSize: 20_000_000 });

export async function searchLiteApiStaysCached(search: DuffelStaysSearch, signal?: AbortSignal): Promise<DuffelStaysResponse> {
  const key = `${process.env.LITEAPI_CURRENCY || DEFAULT_CURRENCY}:${staysCacheKey(search)}`;
  const kept = cache.get(key);
  if (kept) return JSON.parse(kept);

  const answer = await searchLiteApiStays(search, signal);
  cache.set(key, JSON.stringify(answer), cacheTtlMs());
  return answer;
}

export function clearLiteApiCache() {
  cache.clear();
  amenityByFacility = null;
}
