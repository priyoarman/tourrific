import { HOTEL_GRADIENTS } from "./duffel-to-hotel";
import type { Hotel, Trip } from "./types";

// Sample hotels only; there is no hotel API yet. Results are seeded by
// destination so they stay stable between renders (and between server and client).

function seededRandom(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const hotelNames = [
  "Hotel Aurora",
  "The Linden House",
  "Casa Marea",
  "Harbour Lights Hotel",
  "Villa Serena",
  "The Atelier Rooms",
  "Old Town Suites",
  "Nordlys Boutique Hotel",
  "The Courtyard Residence",
];

const areas = ["City centre", "Old town", "Waterfront", "Arts district", "Near main station"];

const amenityPool = ["Free Wi-Fi", "Breakfast", "Pool", "Gym", "Spa", "Rooftop bar", "Parking"];

export function getHotels(trip: Trip): Hotel[] {
  const dest = trip.destination;
  const rand = seededRandom(`hotels-${dest.city}`);
  const names = hotelNames
    .map((name) => ({ name, order: rand() }))
    .sort((a, b) => a.order - b.order)
    .slice(0, 6)
    .map((h) => h.name);

  return names.map((name, i) => {
    const stars = 3 + Math.floor(rand() * 3);
    const rating = Math.round((7.8 + rand() * 1.8) * 10) / 10;
    const amenities = amenityPool.filter(() => rand() > 0.55).slice(0, 3);
    return {
      id: `${dest.airport}-hotel-${i}`,
      name,
      area: areas[Math.floor(rand() * areas.length)],
      distanceKm: Math.round((0.3 + rand() * 3) * 10) / 10,
      stars,
      rating,
      reviewCount: 180 + Math.floor(rand() * 2400),
      nightlyPrice: Math.round(
        dest.nightlyRate * (0.55 + (stars - 3) * 0.3 + rand() * 0.4),
      ),
      currency: "USD",
      amenities: amenities.length ? amenities : ["Free Wi-Fi"],
      photoUrl: null,
      gradient: HOTEL_GRADIENTS[i % HOTEL_GRADIENTS.length],
      freeCancellation: rand() > 0.4,
    };
  });
}
