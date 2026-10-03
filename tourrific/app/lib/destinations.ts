import type { Destination, Trip } from "./types";

export const ORIGIN = { city: "Copenhagen", airport: "CPH" };

// Order matters: the first destination whose keyword appears in the prompt wins,
// so specific places come before vague moods like "warm" or "beach".
export const destinations: Destination[] = [
  {
    city: "Barcelona",
    country: "Spain",
    flag: "🇪🇸",
    airport: "BCN",
    flightMinutes: 170,
    basePrice: 43,
    nightlyRate: 135,
    keywords: ["barcelona", "catalonia"],
  },
  {
    city: "London",
    country: "United Kingdom",
    flag: "🇬🇧",
    airport: "LHR",
    flightMinutes: 130,
    basePrice: 53,
    nightlyRate: 180,
    keywords: ["london", "england", "uk"],
  },
  {
    city: "Madrid",
    country: "Spain",
    flag: "🇪🇸",
    airport: "MAD",
    flightMinutes: 210,
    basePrice: 80,
    nightlyRate: 120,
    keywords: ["madrid"],
  },
  {
    city: "Lisbon",
    country: "Portugal",
    flag: "🇵🇹",
    airport: "LIS",
    flightMinutes: 185,
    basePrice: 68,
    nightlyRate: 115,
    keywords: ["lisbon", "portugal"],
  },
  {
    city: "Paris",
    country: "France",
    flag: "🇫🇷",
    airport: "CDG",
    flightMinutes: 115,
    basePrice: 49,
    nightlyRate: 190,
    keywords: ["paris", "france"],
  },
  {
    city: "Athens",
    country: "Greece",
    flag: "🇬🇷",
    airport: "ATH",
    flightMinutes: 195,
    basePrice: 72,
    nightlyRate: 110,
    keywords: ["athens", "greece", "greek", "santorini", "island", "islands"],
  },
  {
    city: "Tokyo",
    country: "Japan",
    flag: "🇯🇵",
    airport: "HND",
    flightMinutes: 790,
    basePrice: 420,
    nightlyRate: 150,
    keywords: ["tokyo", "japan"],
  },
  {
    city: "Innsbruck",
    country: "Austria",
    flag: "🇦🇹",
    airport: "INN",
    flightMinutes: 125,
    basePrice: 89,
    nightlyRate: 125,
    keywords: ["innsbruck", "austria", "alpine", "alps", "road trip", "mountain", "mountains"],
  },
  {
    city: "Palma",
    country: "Spain",
    flag: "🇪🇸",
    airport: "PMI",
    flightMinutes: 195,
    basePrice: 76,
    nightlyRate: 140,
    keywords: ["palma", "majorca", "mallorca", "warm", "sun", "sunny", "beach", "beaches"],
  },
];

const DEFAULT_DESTINATION = destinations[3]; // Lisbon

export function findDestination(prompt: string): Destination | undefined {
  const text = prompt.toLowerCase();
  // Whole words only, so "uk" doesn't match "Ukraine" or "sun" match "Sunday".
  return destinations.find((d) =>
    d.keywords.some((k) => new RegExp(`\\b${k}\\b`).test(text)),
  );
}

export function resolveDestination(prompt: string): Destination {
  return findDestination(prompt) ?? DEFAULT_DESTINATION;
}

/** Picks a different destination than the current one, for "Surprise me". */
export function surpriseDestination(current: Destination): Destination {
  const index = destinations.findIndex((d) => d.city === current.city);
  return destinations[(index + 4) % destinations.length];
}

export function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function buildTrip(destination: Destination, today: string): Trip {
  const nights = 7;
  const departDate = addDays(today, 14);
  return {
    origin: ORIGIN,
    destination,
    departDate,
    returnDate: addDays(departDate, nights),
    nights,
    travelers: 1,
  };
}
