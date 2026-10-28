import { HOTEL_GRADIENTS } from "../duffel-to-hotel.ts";
import type { FlightOffer, Hotel } from "../types";
import type { StreamHotels } from "../types/stream-events";

export const flight = (): FlightOffer => ({
  id: "off_0000AWr2VsUNIF1Vl91xg0",
  airline: { name: "Scandinavian Airlines", code: "SK", logoUrl: "https://assets.duffel.com/img/airlines/SK.svg" },
  flightNumber: "SK1001",
  outbound: {
    origin: "CPH",
    destination: "LIS",
    departureTime: "2026-11-12T08:30:00",
    arrivalTime: "2026-11-12T11:15:00",
    durationMinutes: 285,
    stops: [],
  },
  inbound: {
    origin: "LIS",
    destination: "CPH",
    departureTime: "2026-11-16T12:40:00",
    arrivalTime: "2026-11-16T19:05:00",
    durationMinutes: 325,
    stops: [{ airport: "AMS", layoverMinutes: 75 }],
  },
  totalPrice: 412.5,
  currency: "EUR",
  cabin: "Economy",
  fareBrand: "Economy Light",
  baggage: "1 carry-on bag",
});

export const hotel = (): Hotel => ({
  id: "acc_0000AWr2VsUNIF1Vl91xg0",
  name: "Casa do Rio",
  area: "Rua da Prata 10, Lisbon",
  distanceKm: 1.2,
  stars: 4,
  rating: 8.6,
  reviewCount: 412,
  nightlyPrice: 120,
  currency: "EUR",
  amenities: ["Free Wi-Fi", "Pool"],
  photoUrl: "https://assets.duffel.com/img/stays/image.jpg",
  gradient: HOTEL_GRADIENTS[0],
  freeCancellation: true,
});

export const stay = (): StreamHotels["stay"] => ({
  city: "Lisbon",
  around: "city",
  checkIn: "2026-11-12",
  checkOut: "2026-11-16",
  nights: 4,
  nightsAssumed: false,
  guests: 1,
  rooms: 1,
});

export const trip = () => ({ flight: flight(), hotel: hotel(), stay: stay() });
