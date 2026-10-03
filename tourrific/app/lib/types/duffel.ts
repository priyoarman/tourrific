// The parts of a Duffel flight offer this app reads. Duffel returns far more;
// add fields here only when something starts using them.
// Sample data in this shape: api/src/data/mock-flights.json.

export type DuffelAirline = {
  /** 2-letter airline code, e.g. "BA". Duffel may omit it for some carriers. */
  iata_code: string | null;
  name: string;
  /** Square logo (SVG). */
  logo_symbol_url: string | null;
  /** Wide logo with the airline's name (SVG). Only present on an offer's owner. */
  logo_lockup_url?: string | null;
};

export type DuffelPlace = {
  iata_code: string;
  name: string;
  city_name: string | null;
  iata_country_code: string;
  /** IANA zone, e.g. "Europe/Copenhagen". */
  time_zone: string | null;
  latitude: number | null;
  longitude: number | null;
  type: "airport" | "city";
};

export type DuffelBaggage = {
  type: "checked" | "carry_on";
  quantity: number;
};

export type DuffelSegmentPassenger = {
  passenger_id: string;
  cabin_class: string;
  cabin_class_marketing_name: string;
  baggages: DuffelBaggage[];
};

/** One flight: a single take-off and landing. */
export type DuffelSegment = {
  id: string;
  /**
   * Local time at the airport with no UTC offset, e.g. "2026-11-12T08:30:00".
   * Don't subtract these to get a duration, since the two ends can be in
   * different time zones; use `duration` instead.
   */
  departing_at: string;
  arriving_at: string;
  /** ISO 8601 duration, e.g. "PT1H53M". */
  duration: string | null;
  origin: DuffelPlace;
  destination: DuffelPlace;
  origin_terminal: string | null;
  destination_terminal: string | null;
  /** The airline that sold the flight, and the one that actually flies it. */
  marketing_carrier: DuffelAirline;
  operating_carrier: DuffelAirline | null;
  marketing_carrier_flight_number: string;
  operating_carrier_flight_number: string | null;
  aircraft: { name: string } | null;
  passengers: DuffelSegmentPassenger[];
};

/** One direction of the trip (outbound or return), made of one or more segments. */
export type DuffelSlice = {
  id: string;
  /** ISO 8601 duration for the whole direction, including layovers. */
  duration: string | null;
  fare_brand_name: string | null;
  origin: DuffelPlace;
  destination: DuffelPlace;
  segments: DuffelSegment[];
};

type DuffelCondition = {
  allowed: boolean;
  penalty_amount: string | null;
  penalty_currency: string | null;
} | null;

export type DuffelOffer = {
  id: string;
  /** Amounts are decimal strings, e.g. "96.85". Always show them with their currency. */
  total_amount: string;
  /** ISO 4217 code, e.g. "EUR". */
  total_currency: string;
  base_amount: string;
  base_currency: string;
  tax_amount: string | null;
  tax_currency: string | null;
  total_emissions_kg: string | null;
  /** After this moment the price is no longer guaranteed. */
  expires_at: string;
  /** The airline selling the offer. */
  owner: DuffelAirline;
  conditions: {
    change_before_departure?: DuffelCondition;
    refund_before_departure?: DuffelCondition;
  } | null;
  passengers: { id: string; type: string | null }[];
  /** One slice for a one-way trip, two for a return. */
  slices: DuffelSlice[];
};
