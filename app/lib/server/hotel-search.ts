// The hotel search that goes with a flight search: the same place, dates and
// travellers, asked of Duffel Stays.
import { addDays, ONE_WAY_NIGHTS } from "../destinations.ts";
import { toHotel } from "../duffel-to-hotel.ts";
import type { StreamHotels } from "../types/stream-events";
import type { TripQuery } from "../types/trip-query";
import { searchStaysCached } from "./duffel-stays.ts";
import { passengerCount } from "./flight-filters.ts";
import { stayLocation } from "./stay-location.ts";

/** Duffel can answer with hundreds; the column shows the first of them, in Duffel's order. */
const MAX_HOTELS = 30;
/** The longest stay Duffel searches. */
const MAX_NIGHTS = 99;
const GUESTS_PER_ROOM = 2;

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
 */
export async function searchHotels(query: TripQuery, destination: string, signal?: AbortSignal): Promise<StreamHotels | null> {
  const checkIn = query.departure_date;
  if (!checkIn) return null;

  const nights = query.return_date ? nightsBetween(checkIn, query.return_date) : ONE_WAY_NIGHTS;
  if (!(nights >= 1 && nights <= MAX_NIGHTS)) return null;

  const location = await stayLocation(destination, signal);
  if (!location) return null;

  const guests = passengerCount(query);
  const stay: StreamHotels["stay"] = {
    city: location.city,
    around: location.around,
    checkIn,
    checkOut: addDays(checkIn, nights),
    nights,
    nightsAssumed: !query.return_date,
    guests,
    rooms: Math.ceil(guests / GUESTS_PER_ROOM),
  };

  try {
    if (signal?.aborted) return { hotels: [], totalHotels: 0, stay, failed: true };

    const { latitude, longitude, radius } = location;
    const answer = await searchStaysCached(
      {
        location: { radius, geographic_coordinates: { latitude, longitude } },
        check_in_date: stay.checkIn,
        check_out_date: stay.checkOut,
        guests: Array.from({ length: guests }, () => ({ type: "adult" })),
        rooms: stay.rooms,
      },
      signal,
    );
    const found = answer.data?.results ?? [];
    // Distances are only "from the centre" when the centre is what was searched around.
    const centre = location.around === "city" ? { latitude, longitude } : null;

    return { hotels: found.slice(0, MAX_HOTELS).map((result) => toHotel(result, centre)), totalHotels: found.length, stay };
  } catch (error) {
    if (!signal?.aborted) console.warn("Hotel search failed:", error instanceof Error ? error.message : error);
    return { hotels: [], totalHotels: 0, stay, failed: true };
  }
}
