// Where to look for hotels when the flight search ends at an airport. Duffel
// Stays searches around a point, and an airport is often 20 km out of town, so
// the city the airport serves is looked up with Open-Meteo's geocoding API
// (https://open-meteo.com/en/docs/geocoding-api: no key, free for non-commercial use).
import { distanceKm, type Coordinates } from "../duffel-to-hotel.ts";
import { airports } from "./airports.ts";

const GEOCODER_URL = "https://geocoding-api.open-meteo.com/v1/search";
// Hotels wait on this before their own search starts, so it gets little time.
const DEFAULT_TIMEOUT_MS = 4_000;

/** How far around a city centre to look, in kilometres. */
const CITY_RADIUS_KM = 5;
/** Wider when only the airport is known, to reach the town it serves. */
const AIRPORT_RADIUS_KM = 25;
/** A place by the right name further than this from the airport is another place. */
const MAX_KM_FROM_AIRPORT = 100;

export type StayLocation = Coordinates & {
  /** Kilometres around the point to search. */
  radius: number;
  /** The city the airport serves, e.g. "Lisbon". Null when the airport list doesn't say. */
  city: string | null;
  /** "city" when the point is the city centre; "airport" when it could not be found and the airport stands in. */
  around: "city" | "airport";
};

// City centres don't move, and there is one per airport at most, so they are kept for good.
const centres = new Map<string, Coordinates>();

/** "Paris (Roissy-en-France)" → "Paris", "Faro / Algarve" → "Faro". */
function cityName(municipality: string) {
  return municipality.replace(/\(.*?\)/g, "").split(/[/,]/)[0].trim();
}

/** Asks the geocoder for towns and cities called `city` in `country`, best match first. Throws when it fails or is too slow. */
async function geocode(city: string, country: string, signal?: AbortSignal): Promise<Coordinates[]> {
  const url = new URL(GEOCODER_URL);
  url.search = new URLSearchParams({ name: city, countryCode: country, count: "5", language: "en", format: "json" }).toString();

  // Read per call, so a changed .env.local is picked up without a restart.
  const timeout = AbortSignal.timeout(Number(process.env.GEOCODER_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS);
  const response = await fetch(url, { cache: "no-store", signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  if (!response.ok) throw new Error(`Geocoder answered ${response.status}.`);

  const answer = (await response.json()) as { results?: { latitude?: unknown; longitude?: unknown; feature_code?: unknown }[] };
  return (answer.results ?? []).flatMap(({ latitude, longitude, feature_code }) =>
    // "PPL…" marks a populated place. The name also finds airports and stations, which are not the centre.
    typeof latitude === "number" && typeof longitude === "number" && String(feature_code).startsWith("PPL")
      ? [{ latitude, longitude }]
      : [],
  );
}

/**
 * The point and radius to search hotels around for a trip to `airportCode`
 * ("LIS"): the centre of the city it serves, or the airport itself with a
 * wider radius when the city can't be found. Null for a code that isn't an airport.
 *
 * Never throws. A geocoder that fails or is slow costs the city centre, not the search.
 */
export async function stayLocation(airportCode: string, signal?: AbortSignal): Promise<StayLocation | null> {
  const code = airportCode.trim().toUpperCase();
  // Some rows of the airport list have no code; an empty one must not match them.
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
      // Towns share names; the one meant is the one this airport is near.
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

/** Forgets every city centre looked up so far. For tests. */
export function clearStayLocations() {
  centres.clear();
}
