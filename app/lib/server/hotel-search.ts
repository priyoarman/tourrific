import { addDays, destinations, ONE_WAY_NIGHTS } from "../destinations.ts";
import { toHotel } from "../duffel-to-hotel.ts";
import { getHotels } from "../mock-results.ts";
import type { StreamHotels } from "../types/stream-events";
import type { TripQuery } from "../types/trip-query";
import { searchStaysCached } from "./duffel-stays.ts";
import { passengerCount } from "./flight-filters.ts";
import { searchLiteApiStaysCached } from "./liteapi-stays.ts";
import { duffelStaysOptions, filterStays } from "./hotel-filters.ts";
import { stayLocation } from "./stay-location.ts";

const MAX_HOTELS = 30;
const MAX_NIGHTS = 99;
const SAMPLE_NIGHTLY_RATE = 130;

function nightsBetween(from: string, to: string) {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

export function stayNights(query: TripQuery) {
  if (!query.departure_date) return null;
  const nights = query.return_date ? nightsBetween(query.departure_date, query.return_date) : ONE_WAY_NIGHTS;
  return nights >= 1 && nights <= MAX_NIGHTS ? nights : null;
}

export async function searchHotels(query: TripQuery, destination: string, signal?: AbortSignal): Promise<StreamHotels | null> {
  const checkIn = query.departure_date;
  const nights = stayNights(query);
  if (!checkIn || !nights) return null;

  const location = await stayLocation(destination, signal);
  if (!location) return null;

  const options = duffelStaysOptions(query);
  const stay: StreamHotels["stay"] = {
    city: location.city,
    around: location.around,
    checkIn,
    checkOut: addDays(checkIn, nights),
    nights,
    nightsAssumed: !query.return_date,
    guests: passengerCount(query),
    rooms: options.rooms,
  };

  try {
    if (signal?.aborted) return { hotels: [], totalHotels: 0, stay, failed: true };

    const { latitude, longitude, radius } = location;
    const searchStays = process.env.LITEAPI_KEY ? searchLiteApiStaysCached : searchStaysCached;
    const answer = await searchStays(
      {
        location: { radius, geographic_coordinates: { latitude, longitude } },
        check_in_date: stay.checkIn,
        check_out_date: stay.checkOut,
        ...options,
      },
      signal,
    );
    const { results, labels, unfilteredCount } = filterStays(answer.data?.results ?? [], query);
    const centre = location.around === "city" ? { latitude, longitude } : null;
    const hotels = results.slice(0, MAX_HOTELS).map((result) => {
      const hotel = toHotel(result, centre, query.hotel_amenities ?? []);
      return options.free_cancellation_only ? { ...hotel, freeCancellation: true } : hotel;
    });

    return { hotels, totalHotels: results.length, stay, filters: { labels, unfilteredCount } };
  } catch (error) {
    const failed: StreamHotels = { hotels: [], totalHotels: 0, stay, failed: true };
    if (signal?.aborted) return failed;

    const reason = error instanceof Error ? error.message : error;
    if (process.env.DUFFEL_USE_MOCK?.toLowerCase() !== "true") {
      console.warn("Hotel search failed:", reason);
      return failed;
    }

    console.warn("Hotel search failed; falling back to sample hotels:", reason);
    const airport = destination.trim().toUpperCase();
    const known = destinations.find((place) => place.airport === airport);
    const hotels = getHotels({
      city: location.city ?? known?.city ?? airport,
      airport,
      nightlyRate: known?.nightlyRate ?? SAMPLE_NIGHTLY_RATE,
    });
    return { hotels, totalHotels: hotels.length, stay, sample: true };
  }
}
