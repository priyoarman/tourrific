import data from "airports-json";

export type Airport = {
  type: string;
  name: string;
  latitude_deg: string;
  longitude_deg: string;
  continent: string;
  iso_country: string;
  municipality: string;
  scheduled_service: string;
  iata_code: string;
};

export const airports = data.airports as Airport[];

export const AIRPORT_TYPE_PRIORITY: Record<string, number> = {
  large_airport: 0,
  medium_airport: 1,
  small_airport: 2,
};

export function cityName(municipality: string) {
  return municipality.replace(/\(.*?\)/g, "").split(/[/,]/)[0].trim();
}

export function airportCity(code: string) {
  const wanted = code.trim().toUpperCase();
  const airport = wanted ? airports.find((candidate) => candidate.iata_code === wanted) : undefined;
  return airport ? cityName(airport.municipality) || null : null;
}
