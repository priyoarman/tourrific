export type Destination = {
  city: string;
  country: string;
  flag: string;
  airport: string;
  /** Typical door-to-door flight time from the origin, in minutes. */
  flightMinutes: number;
  /** Typical one-way fare from the origin, in USD. */
  basePrice: number;
  /** Typical nightly rate for a mid-range hotel, in USD. */
  nightlyRate: number;
  keywords: string[];
};

export type Trip = {
  origin: { city: string; airport: string };
  destination: Destination;
  /** ISO date strings (YYYY-MM-DD). */
  departDate: string;
  returnDate: string;
  nights: number;
  travelers: number;
};

// What the flight cards render. Real Duffel offers are converted into this
// shape by `toFlightOffer` in duffel-to-flight-offer.ts.
export type FlightSlice = {
  /** Airport codes, e.g. "CPH". */
  origin: string;
  destination: string;
  /** Local time at that airport with no UTC offset, e.g. "2026-11-12T08:30:00". */
  departureTime: string;
  arrivalTime: string;
  /** Whole journey in this direction, including layovers. */
  durationMinutes: number;
  stops: { airport: string; layoverMinutes: number }[];
};

export type Airline = {
  name: string;
  /** 2-letter airline code, or "" when unknown. */
  code: string;
  logoUrl: string | null;
};

export type FlightOffer = {
  id: string;
  airline: Airline;
  outbound: FlightSlice;
  /** Null for a one-way trip. */
  inbound: FlightSlice | null;
  totalPrice: number;
  /** ISO 4217 code, e.g. "EUR". */
  currency: string;
  cabin: string;
  baggage: string;
};

export type Hotel = {
  id: string;
  name: string;
  area: string;
  distanceKm: number;
  stars: number;
  rating: number;
  reviewCount: number;
  nightlyPrice: number;
  amenities: string[];
  gradient: string;
  freeCancellation: boolean;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  /** Assistant text may wrap phrases in **double asterisks** for emphasis. */
  text: string;
};

export type RoadStop = {
  id: string;
  city: string;
  country: string;
  flag: string;
  lat: number;
  lng: number;
  nights: number;
  /** Typical nightly rate for a mid-range hotel, in USD. */
  nightlyRate: number;
  highlights: string[];
};

export type RoadTripRoute = {
  id: string;
  title: string;
  region: string;
  keywords: string[];
  stops: RoadStop[];
};

export type DriveLeg = { km: number; minutes: number };

export type RoadTripStop = RoadStop & {
  /** ISO date strings (YYYY-MM-DD). */
  arriveDate: string;
  leaveDate: string;
  /** The drive from the previous stop; null for the starting point. */
  leg: DriveLeg | null;
};

export type RoadTrip = {
  route: RoadTripRoute;
  stops: RoadTripStop[];
  startDate: string;
  endDate: string;
  nights: number;
  totalKm: number;
  totalDriveMinutes: number;
  travelers: number;
};
