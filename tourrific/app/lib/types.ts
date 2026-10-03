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

// Shaped like a simplified Duffel offer so it can be swapped for the real API later.
export type FlightSlice = {
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  stops: { airport: string; layoverMinutes: number }[];
};

export type Airline = {
  name: string;
  code: string;
  color: string;
};

export type FlightOffer = {
  id: string;
  airline: Airline;
  outbound: FlightSlice;
  inbound: FlightSlice;
  totalPrice: number;
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
