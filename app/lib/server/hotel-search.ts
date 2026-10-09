// The hotel search that goes with a flight search: the same place, dates and
// travellers, asked of LiteAPI when LITEAPI_KEY is set and of Duffel Stays otherwise.
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

/** A search can answer with hundreds; the column shows the first of them, in the order they came. */
const MAX_HOTELS = 30;
/** The longest stay searched. */
const MAX_NIGHTS = 99;
/** What a night costs in the sample hotels of a place the app has no figure for, in USD. */
const SAMPLE_NIGHTLY_RATE = 130;

function nightsBetween(from: string, to: string) {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

/**
 * How many nights the trip in `query` stays: from the day it flies out to the
 * day it flies back, or ONE_WAY_NIGHTS for a one-way trip. Null when there is
 * no stay to search: no departure date, no night between the flights, or more
 * nights than can be searched.
 */
export function stayNights(query: TripQuery) {
  if (!query.departure_date) return null;
  const nights = query.return_date ? nightsBetween(query.departure_date, query.return_date) : ONE_WAY_NIGHTS;
  return nights >= 1 && nights <= MAX_NIGHTS ? nights : null;
}

/**
 * Finds hotels for the trip in `query`, which flies to the airport `destination`
 * ("LIS") and has a departure date. Guests check in the day they fly out and
 * leave the day they fly back; a one-way trip is given ONE_WAY_NIGHTS nights.
 *
 * Null when there is nothing to search: no night between the flights, a stay
 * longer than can be searched, or an airport that isn't known.
 *
 * Never throws. When the search fails, the answer has no hotels and `failed`
 * set, so the flights it goes with are not held up by it. Aborting `signal`
 * drops the request the same way.
 *
 * With DUFFEL_USE_MOCK=true, a failed search answers with sample hotels
 * instead, marked `sample`, as a failed flight search answers with sample flights.
 */
export async function searchHotels(query: TripQuery, destination: string, signal?: AbortSignal): Promise<StreamHotels | null> {
  const checkIn = query.departure_date;
  const nights = stayNights(query);
  if (!checkIn || !nights) return null;

  const location = await stayLocation(destination, signal);
  if (!location) return null;

  // The provider narrows the search where it can; the rest is filtered once the hotels are in.
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
    // Read per call, so a changed .env.local is picked up without a restart.
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
    // Distances are only "from the centre" when the centre is what was searched around.
    const centre = location.around === "city" ? { latitude, longitude } : null;
    const hotels = results.slice(0, MAX_HOTELS).map((result) => {
      const hotel = toHotel(result, centre, query.hotel_amenities ?? []);
      // Nothing else was asked for, whether or not this answer shows the rate's terms.
      return options.free_cancellation_only ? { ...hotel, freeCancellation: true } : hotel;
    });

    return { hotels, totalHotels: results.length, stay, filters: { labels, unfilteredCount } };
  } catch (error) {
    const failed: StreamHotels = { hotels: [], totalHotels: 0, stay, failed: true };
    // Nobody is waiting for the answer any more, sample or not.
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
