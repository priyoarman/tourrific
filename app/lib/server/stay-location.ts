import { distanceKm, type Coordinates } from "../duffel-to-hotel.ts";
import { airports, cityName } from "./airports.ts";

const GEOCODER_URL = "https://geocoding-api.open-meteo.com/v1/search";
const DEFAULT_TIMEOUT_MS = 4_000;

const CITY_RADIUS_KM = 5;
const AIRPORT_RADIUS_KM = 25;
const MAX_KM_FROM_AIRPORT = 100;

export type StayLocation = Coordinates & {
  radius: number;
  city: string | null;
  around: "city" | "airport";
};

const centres = new Map<string, Coordinates>();

async function geocode(city: string, country: string, signal?: AbortSignal): Promise<Coordinates[]> {
  const url = new URL(GEOCODER_URL);
  url.search = new URLSearchParams({ name: city, countryCode: country, count: "5", language: "en", format: "json" }).toString();

  const timeout = AbortSignal.timeout(Number(process.env.GEOCODER_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS);
  const response = await fetch(url, { cache: "no-store", signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  if (!response.ok) throw new Error(`Geocoder answered ${response.status}.`);

  const answer = (await response.json()) as { results?: { latitude?: unknown; longitude?: unknown; feature_code?: unknown }[] };
  return (answer.results ?? []).flatMap(({ latitude, longitude, feature_code }) =>
    typeof latitude === "number" && typeof longitude === "number" && String(feature_code).startsWith("PPL")
      ? [{ latitude, longitude }]
      : [],
  );
}

export async function stayLocation(airportCode: string, signal?: AbortSignal): Promise<StayLocation | null> {
  const code = airportCode.trim().toUpperCase();
  const airport = code ? airports.find((candidate) => candidate.iata_code === code) : undefined;
  if (!airport) return null;

  const at = { latitude: Number.parseFloat(airport.latitude_deg), longitude: Number.parseFloat(airport.longitude_deg) };
  if (!Number.isFinite(at.latitude) || !Number.isFinite(at.longitude)) return null;

  const city = cityName(airport.municipality) || null;
  const fromAirport: StayLocation = { ...at, radius: AIRPORT_RADIUS_KM, city, around: "airport" };
  if (!city) return fromAirport;

  let centre = centres.get(code);
  if (!centre) {
    try {
      const places = await geocode(city, airport.iso_country, signal);
      centre = places.find((place) => distanceKm(at, place) <= MAX_KM_FROM_AIRPORT);
      if (centre) centres.set(code, centre);
    } catch (error) {
      if (!signal?.aborted) {
        console.warn(`Could not look up ${city}; searching around ${code} instead:`, error instanceof Error ? error.message : error);
      }
    }
  }

  return centre ? { ...centre, radius: CITY_RADIUS_KM, city, around: "city" } : fromAirport;
}

export function clearStayLocations() {
  centres.clear();
}
