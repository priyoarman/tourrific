import type { FlightOffer, Hotel } from "./types";
import type { StreamHotels } from "./types/stream-events";

/**
 * What the flight and the whole stay cost together, or null when they can't be
 * added up: a one-way trip's nights are a guess, and prices in different
 * currencies aren't converted.
 */
export function tripTotal(
  flight: FlightOffer,
  hotel: Hotel,
  { nights, nightsAssumed }: Pick<StreamHotels["stay"], "nights" | "nightsAssumed">,
) {
  if (nightsAssumed || flight.currency !== hotel.currency) return null;
  return flight.totalPrice + hotel.nightlyPrice * nights;
}
