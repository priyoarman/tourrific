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
  /** The first flight of the trip, e.g. "BA811". Saved flights are stored under it. */
  flightNumber: string;
  outbound: FlightSlice;
  /** Null for a one-way trip. */
  inbound: FlightSlice | null;
  totalPrice: number;
  /** ISO 4217 code, e.g. "EUR". */
  currency: string;
  cabin: string;
  /** The airline's name for this fare, e.g. "Economy Light". Tells apart offers on the same flights. */
  fareBrand: string | null;
  baggage: string;
};

// What the hotel cards render. Real Duffel stays are converted into this shape
// by `toHotel` in duffel-to-hotel.ts; the sample hotels are built in mock-results.ts.
export type Hotel = {
  id: string;
  name: string;
  /** Street address or neighbourhood, or "" when unknown. */
  area: string;
  /** From the point the search was made around. Null when unknown. */
  distanceKm: number | null;
  /** 1 to 5, or null for a hotel without stars. */
  stars: number | null;
  /** What guests gave it, out of 10. Null when nobody reviewed it. */
  rating: number | null;
  reviewCount: number | null;
  nightlyPrice: number;
  /** ISO 4217 code, e.g. "EUR". */
  currency: string;
  amenities: string[];
  photoUrl: string | null;
  /** Tailwind gradient classes, shown when there is no photo. */
  gradient: string;
  freeCancellation: boolean;
};

/** A flight the signed-in user saved, as stored by /api/saved-flights. */
export type SavedFlight = {
  id: string;
  flightNumber: string;
  airline: Airline;
  /** Airport codes, e.g. "CPH". */
  origin: string;
  destination: string;
  /** Local time at the origin airport, e.g. "2026-11-12T08:30:00". */
  departureTime: string;
  price: number;
  /** ISO 4217 code, or null when it was saved without one. */
  currency: string | null;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  /** Assistant text may wrap phrases in **double asterisks** for emphasis. */
  text: string;
  /** Buttons shown under the text. "auth" offers Sign In and Sign Up to a visitor who isn't signed in. */
  action?: "auth";
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
