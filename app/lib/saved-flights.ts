import { api } from "./api.ts";
import type { FlightOffer, SavedFlight } from "./types";

/** A row of the backend's saved_offers table, as it arrives in JSON. */
export type SavedFlightRow = {
  id: string;
  flightNumber: string;
  airlineCode: string | null;
  airlineName: string | null;
  origin: string;
  destination: string;
  /** A decimal string, e.g. "96.85". */
  price: string | number;
  departureTime: string;
  currency?: { code: string } | null;
};

const logoUrl = (code: string) =>
  `https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/${code}.svg`;

export function toSavedFlight(row: SavedFlightRow): SavedFlight {
  const code = row.airlineCode ?? "";
  return {
    id: String(row.id),
    flightNumber: row.flightNumber,
    airline: {
      name: row.airlineName ?? (code || "Airline"),
      code,
      logoUrl: /^[A-Z0-9]{2}$/.test(code) ? logoUrl(code) : null,
    },
    origin: row.origin,
    destination: row.destination,
    // Stored as UTC with the airport's wall-clock time; drop the ".000Z" again.
    departureTime: row.departureTime.slice(0, 19),
    price: Number(row.price),
    currency: row.currency?.code ?? null,
  };
}

/** What POST /api/saved-flights/save expects. */
export function toSavePayload(offer: FlightOffer) {
  return {
    flight_number: offer.flightNumber,
    origin: offer.outbound.origin,
    destination: offer.outbound.destination,
    price: offer.totalPrice,
    // Duffel's times are local with no offset. The "Z" stops the server from
    // shifting them by its own time zone; `toSavedFlight` reads them back as written.
    departure_time: `${offer.outbound.departureTime.slice(0, 19)}Z`,
    currency_code: offer.currency,
    airline_code: offer.airline.code || null,
    airline_name: offer.airline.name,
  };
}

type Keyed = { flightNumber: string; departureTime: string; price: number };
const key = ({ flightNumber, departureTime, price }: Keyed) =>
  `${flightNumber}|${departureTime.slice(0, 16)}|${price.toFixed(2)}`;

/** The saved flight matching this offer: same first flight, departure and price. */
export function findSaved(saved: SavedFlight[], offer: FlightOffer) {
  const wanted = key({
    flightNumber: offer.flightNumber,
    departureTime: offer.outbound.departureTime,
    price: offer.totalPrice,
  });
  return saved.find((flight) => key(flight) === wanted);
}

export async function listSavedFlights() {
  const { flights } = await api<{ flights: SavedFlightRow[] }>("/api/saved-flights/saved");
  return flights.map(toSavedFlight);
}

export async function saveFlight(offer: FlightOffer) {
  const { flight } = await api<{ flight: SavedFlightRow }>("/api/saved-flights/save", {
    method: "POST",
    body: toSavePayload(offer),
  });
  return toSavedFlight(flight);
}

export async function removeSavedFlight(id: string) {
  await api(`/api/saved-flights/save/${encodeURIComponent(id)}`, { method: "DELETE" });
}
