import type { FlightOffer, FlightSlice } from "./types";
import type { DuffelOffer, DuffelSegment, DuffelSlice } from "./types/duffel";

/** "PT1H53M" → 113, "P1DT2H" → 1560. Returns null when Duffel sends no duration. */
export function parseIsoDuration(value: string | null | undefined): number | null {
  const match = value?.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:[\d.]+S)?)?$/);
  if (!match) return null;
  const [days, hours, minutes] = match.slice(1).map((part) => Number(part ?? 0));
  return days * 1440 + hours * 60 + minutes;
}

/**
 * Minutes between two of Duffel's local date-times. Only valid when both are
 * at the same airport (a layover), because the strings carry no time zone.
 */
function minutesBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}Z`) - Date.parse(`${from}Z`)) / 60_000);
}

function layovers(segments: DuffelSegment[]): FlightSlice["stops"] {
  return segments.slice(0, -1).map((segment, i) => ({
    airport: segment.destination.iata_code,
    layoverMinutes: minutesBetween(segment.arriving_at, segments[i + 1].departing_at),
  }));
}

function toFlightSlice(slice: DuffelSlice): FlightSlice {
  const first = slice.segments[0];
  const last = slice.segments[slice.segments.length - 1];
  const stops = layovers(slice.segments);

  // Prefer Duffel's own total. Subtracting departure from arrival would be wrong
  // whenever the two airports are in different time zones.
  const flying = slice.segments.reduce((sum, s) => sum + (parseIsoDuration(s.duration) ?? 0), 0);
  const waiting = stops.reduce((sum, stop) => sum + stop.layoverMinutes, 0);

  return {
    origin: first.origin.iata_code,
    destination: last.destination.iata_code,
    departureTime: first.departing_at,
    arrivalTime: last.arriving_at,
    durationMinutes: parseIsoDuration(slice.duration) ?? flying + waiting,
    stops,
  };
}

function describeBaggage(offer: DuffelOffer) {
  const baggages = offer.slices[0]?.segments[0]?.passengers[0]?.baggages ?? [];
  const count = (type: string) =>
    baggages.filter((b) => b.type === type).reduce((sum, b) => sum + b.quantity, 0);
  const carryOn = count("carry_on");
  const checked = count("checked");
  const checkedText = `${checked} checked bag${checked === 1 ? "" : "s"}`;

  if (carryOn && checked) return `Cabin bag + ${checkedText}`;
  if (checked) return checkedText;
  if (carryOn) return "Cabin bag only";
  return "No baggage included";
}

/** Converts one Duffel offer into the shape the flight cards render. */
export function toFlightOffer(offer: DuffelOffer): FlightOffer {
  const [outbound, inbound] = offer.slices;

  return {
    id: offer.id,
    airline: {
      name: offer.owner.name,
      code: offer.owner.iata_code ?? "",
      logoUrl: offer.owner.logo_symbol_url ?? null,
    },
    outbound: toFlightSlice(outbound),
    inbound: inbound ? toFlightSlice(inbound) : null,
    totalPrice: Number.parseFloat(offer.total_amount),
    currency: offer.total_currency,
    cabin: outbound.segments[0]?.passengers[0]?.cabin_class_marketing_name ?? "Economy",
    baggage: describeBaggage(offer),
  };
}
