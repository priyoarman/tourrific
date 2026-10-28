import type { StreamHotels } from "./types/stream-events";

export type Destination = {
  city: string;
  country: string;
  flag: string;
  airport: string;
  flightMinutes: number;
  basePrice: number;
  nightlyRate: number;
  keywords: string[];
};

export type Trip = {
  origin: { city: string; airport: string };
  destination: Destination;
  departDate: string;
  returnDate: string;
  nights: number;
  travelers: number;
};

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
  logoUrl: string | null;
};

export type FlightOffer = {
  id: string;
  airline: Airline;
  flightNumber: string;
  outbound: FlightSlice;
  inbound: FlightSlice | null;
  totalPrice: number;
  currency: string;
  cabin: string;
  fareBrand: string | null;
  baggage: string;
};

export type Hotel = {
  id: string;
  name: string;
  area: string;
  distanceKm: number | null;
  stars: number | null;
  rating: number | null;
  reviewCount: number | null;
  nightlyPrice: number;
  currency: string;
  amenities: string[];
  photoUrl: string | null;
  gradient: string;
  freeCancellation: boolean;
};

export type PickedTrip = {
  flight: FlightOffer;
  hotel: Hotel;
  stay: StreamHotels["stay"];
};

export type SavedFlight = {
  id: string;
  flightNumber: string;
  airline: Airline;
  origin: string;
  destination: string;
  departureTime: string;
  price: number;
  currency: string | null;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
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
  arriveDate: string;
  leaveDate: string;
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
