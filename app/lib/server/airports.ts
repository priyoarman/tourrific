import data from "airports-json";

/** One row of the airports-json list. Every field is a string; missing values are "". */
export type Airport = {
  /** "large_airport", "medium_airport", "small_airport", ... */
  type: string;
  name: string;
  latitude_deg: string;
  longitude_deg: string;
  /** 2-letter continent code, e.g. "EU". */
  continent: string;
  /** 2-letter country code, e.g. "DK". */
  iso_country: string;
  /** The city the airport serves. */
  municipality: string;
  /** "yes" when airlines fly scheduled services from it. */
  scheduled_service: string;
  /** 3-letter code, e.g. "CPH". */
  iata_code: string;
};

export const airports = data.airports as Airport[];

/** Larger airports are preferred when several match. */
export const AIRPORT_TYPE_PRIORITY: Record<string, number> = {
  large_airport: 0,
  medium_airport: 1,
  small_airport: 2,
};

/** "Paris (Roissy-en-France)" → "Paris", "Faro / Algarve" → "Faro". */
export function cityName(municipality: string) {
  return municipality.replace(/\(.*?\)/g, "").split(/[/,]/)[0].trim();
}

/** The city an airport serves, e.g. "Lisbon" for "LIS", or null when the code isn't known. */
export function airportCity(code: string) {
  const wanted = code.trim().toUpperCase();
  // Some rows of the airport list have no code; an empty one must not match them.
  const airport = wanted ? airports.find((candidate) => candidate.iata_code === wanted) : undefined;
  return airport ? cityName(airport.municipality) || null : null;
}
