// The hotel search that goes with a flight search: the same place, dates and
// travellers, asked of Duffel Stays.
import { addDays, destinations, ONE_WAY_NIGHTS } from "../destinations.ts";
import { toHotel } from "../duffel-to-hotel.ts";
import { getHotels } from "../mock-results.ts";
import type { StreamHotels } from "../types/stream-events";
import type { TripQuery } from "../types/trip-query";
import { searchStaysCached } from "./duffel-stays.ts";
import { passengerCount } from "./flight-filters.ts";
import { duffelStaysOptions, filterStays } from "./hotel-filters.ts";
import { stayLocation } from "./stay-location.ts";

/** Duffel can answer with hundreds; the column shows the first of them, in Duffel's order. */
const MAX_HOTELS = 30;
/** The longest stay Duffel searches. */
const MAX_NIGHTS = 99;
/** What a night costs in the sample hotels of a place the app has no figure for, in USD. */
const SAMPLE_NIGHTLY_RATE = 130;

function nightsBetween(from: string, to: string) {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

/**
 * Finds hotels for the trip in `query`, which flies to the airport `destination`
 * ("LIS") and has a departure date. Guests check in the day they fly out and
 * leave the day they fly back; a one-way trip is given ONE_WAY_NIGHTS nights.
 *
 * Null when there is nothing to search: no night between the flights, a stay
 * longer than Duffel takes, or an airport that isn't known.
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
  if (!checkIn) return null;

  const nights = query.return_date ? nightsBetween(checkIn, query.return_date) : ONE_WAY_NIGHTS;
  if (!(nights >= 1 && nights <= MAX_NIGHTS)) return null;

  const location = await stayLocation(destination, signal);
  if (!location) return null;

  // Duffel narrows the search where it can; the rest is filtered once the hotels are in.
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
    const answer = await searchStaysCached(
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
      // Duffel was asked for nothing else, whether or not this answer shows the rate's terms.
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
