import type { DuffelOffer, DuffelSlice } from "../types/duffel";
import type { CabinClass, DepartureTime, TripQuery } from "../types/trip-query";

const TIME_WINDOWS: Record<DepartureTime, { from: number; to: number; label: string }> = {
  morning: { from: 5 * 60, to: 12 * 60, label: "Morning departure" },
  afternoon: { from: 12 * 60, to: 18 * 60, label: "Afternoon departure" },
  evening: { from: 18 * 60, to: 22 * 60, label: "Evening departure" },
  night: { from: 22 * 60, to: 5 * 60, label: "Night departure" },
};

const CABIN_LABELS: Record<CabinClass, string> = {
  economy: "Economy",
  premium_economy: "Premium economy",
  business: "Business",
  first: "First class",
};

const UNITS_PER_EUR: Record<string, number> = {
  EUR: 1,
  DKK: 7.46,
  SEK: 11.2,
  NOK: 11.6,
  GBP: 0.86,
  USD: 1.1,
  CHF: 0.95,
};

export const MAX_PASSENGERS = 9;

const hhmm = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

export function money(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

export function passengerCount(query: TripQuery) {
  const count = Math.round(Number(query.passengers) || 1);
  return Math.min(Math.max(count, 1), MAX_PASSENGERS);
}

export function duffelSearchOptions(query: TripQuery) {
  const window = query.departure_time ? TIME_WINDOWS[query.departure_time] : null;

  return {
    cabin_class: query.cabin_class ?? "economy",
    passengers: Array.from({ length: passengerCount(query) }, () => ({ type: "adult" })),
    ...(query.direct_only && { max_connections: 0 }),
    outboundDepartureTime:
      window && window.from < window.to
        ? { from: hhmm(window.from), to: hhmm(window.to - 1) }
        : undefined,
  };
}

const isDirect = (slice: DuffelSlice) => slice.segments.length === 1;

function departsWithin(slice: DuffelSlice, window: { from: number; to: number }) {
  const [hours, minutes] = slice.segments[0].departing_at.slice(11, 16).split(":").map(Number);
  const time = hours * 60 + minutes;
  return window.from < window.to ? time >= window.from && time < window.to : time >= window.from || time < window.to;
}

function includesCheckedBag(offer: DuffelOffer) {
  return offer.slices.every((slice) =>
    slice.segments.every((segment) =>
      (segment.passengers[0]?.baggages ?? []).some((bag) => bag.type === "checked" && bag.quantity > 0),
    ),
  );
}

const simplify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

function isAirline(wanted: string, airline: { iata_code: string | null; name: string }) {
  const code = wanted.trim().toUpperCase();
  if (/^[A-Z0-9]{2}$/.test(code)) return airline.iata_code?.toUpperCase() === code;

  const name = simplify(wanted);
  const airlineName = simplify(airline.name);
  return Boolean(name) && (airlineName.includes(name) || name.includes(airlineName));
}

function isFlownBy(offer: DuffelOffer, wanted: string[]) {
  return wanted.some(
    (airline) =>
      isAirline(airline, offer.owner) ||
      offer.slices.every((slice) => slice.segments.every((segment) => isAirline(airline, segment.marketing_carrier))),
  );
}

function airlineNames(wanted: string[], offers: DuffelOffer[]) {
  return wanted.map((airline) => {
    for (const offer of offers) {
      const carriers = [offer.owner, ...offer.slices.flatMap((s) => s.segments.map((seg) => seg.marketing_carrier))];
      const match = carriers.find((carrier) => isAirline(airline, carrier));
      if (match) return match.name;
    }
    return airline;
  });
}

export function convertPrice(amount: number, from: string, to: string) {
  if (from === to) return amount;

  const rateFrom = UNITS_PER_EUR[from];
  const rateTo = UNITS_PER_EUR[to];
  return rateFrom && rateTo ? (amount / rateFrom) * rateTo : null;
}

function priceLimitIn(currency: string, query: TripQuery) {
  if (!query.max_price) return null;
  return convertPrice(query.max_price, query.max_price_currency ?? currency, currency);
}

export type FilterResult = {
  offers: DuffelOffer[];
  labels: string[];
  unfilteredCount: number;
};

export function filterOffers(all: DuffelOffer[], query: TripQuery): FilterResult {
  const labels: string[] = [];
  let offers = all;

  if (query.direct_only) {
    labels.push("Direct");
    offers = offers.filter((offer) => offer.slices.every(isDirect));
  }

  if (query.departure_time) {
    const window = TIME_WINDOWS[query.departure_time];
    labels.push(window.label);
    offers = offers.filter((offer) => departsWithin(offer.slices[0], window));
  }

  if (query.baggage_required) {
    labels.push("Checked bag included");
    offers = offers.filter(includesCheckedBag);
  }

  const airlines = query.preferred_airlines ?? [];
  if (airlines.length > 0) {
    labels.push(airlineNames(airlines, all).join(" or "));
    offers = offers.filter((offer) => isFlownBy(offer, airlines));
  }

  if (query.max_price) {
    const currency = all[0]?.total_currency ?? query.max_price_currency ?? "EUR";
    const limit = priceLimitIn(currency, query);
    const asked = money(query.max_price, query.max_price_currency ?? currency);

    if (limit === null) {
      labels.push(`Under ${asked} (not applied: prices are in ${currency})`);
    } else {
      const converted = query.max_price_currency && query.max_price_currency !== currency;
      labels.push(converted ? `Under ${asked} (about ${money(Math.round(limit), currency)})` : `Under ${asked}`);
      offers = offers.filter((offer) => Number.parseFloat(offer.total_amount) <= limit);
    }
  }

  if (query.cabin_class && query.cabin_class !== "economy") labels.push(CABIN_LABELS[query.cabin_class]);

  return { offers, labels, unfilteredCount: all.length };
}
