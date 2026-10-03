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
