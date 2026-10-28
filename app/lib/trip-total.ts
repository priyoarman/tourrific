import type { FlightOffer, Hotel } from "./types";
import type { StreamHotels } from "./types/stream-events";

export function tripTotal(
  flight: FlightOffer,
  hotel: Hotel,
  { nights, nightsAssumed }: Pick<StreamHotels["stay"], "nights" | "nightsAssumed">,
) {
  if (nightsAssumed || flight.currency !== hotel.currency) return null;
  return flight.totalPrice + hotel.nightlyPrice * nights;
}
