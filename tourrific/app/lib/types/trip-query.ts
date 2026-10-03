// The structured flight search the backend extracts from a chat message with Groq.
// Mirrors api/src/groq/schema.json, so field names stay in snake_case as they
// arrive over the wire. Every field can be null when the user didn't mention it.

export type TripType = "one_way" | "return";

export type DepartureTime = "morning" | "afternoon" | "evening" | "night";

export type TripQuery = {
  trip_type: TripType | null;

  /** 3-letter IATA codes, e.g. "CPH". Origin falls back to the visitor's nearest airport. */
  origin_airport: string | null;
  destination_airport: string | null;

  /** Dates as YYYY-MM-DD. */
  departure_date: string | null;
  return_date: string | null;

  max_price_dkk: number | null;

  /** Moods the user asked for instead of a place, e.g. ["beaches"]. */
  vibe_tags: string[] | null;

  direct_only: boolean | null;
  preferred_airlines: string[] | null;
  baggage_required: boolean | null;
  departure_time: DepartureTime | null;

  // Set when the user names a country, continent or region rather than a city.
  destination_country: string | null;
  /** 2-letter ISO country code, or "EU" for Europe as a whole. */
  destination_country_code: string | null;
  /** 2-letter continent code, e.g. "EU", "AS". */
  destination_continent_code: string | null;
  /** A region or direction, e.g. "south of Spain". */
  destination_area: string | null;

  /**
   * Not part of schema.json: the backend adds this when it picks an airport on
   * the user's behalf ("Since you want beaches, I selected …"). May contain **bold**.
   */
  explanation?: string | null;
};
