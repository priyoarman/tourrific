// The structured search the backend extracts from a chat message with Groq:
// the flights, and what the visitor wants of the hotel that goes with them.
// Mirrors app/lib/server/groq/schema.ts, so field names stay in snake_case as they
// arrive over the wire. Every field can be null when the user didn't mention it.

export type TripType = "one_way" | "return";

export type DepartureTime = "morning" | "afternoon" | "evening" | "night";

export type CabinClass = "economy" | "premium_economy" | "business" | "first";

/** What a hotel can be asked to have. The words are Duffel's amenity types. */
export type HotelAmenity = "wifi" | "pool" | "spa" | "gym" | "parking" | "restaurant" | "room_service" | "pet_friendly";

export type TripQuery = {
  trip_type: TripType | null;

  /** 3-letter IATA codes, e.g. "CPH". Origin falls back to the visitor's nearest airport. */
  origin_airport: string | null;
  destination_airport: string | null;

  /** Dates as YYYY-MM-DD. */
  departure_date: string | null;
  return_date: string | null;

  /** The most the whole trip may cost, as the user said it, e.g. 1000. */
  max_price: number | null;
  /** ISO 4217 code of that limit, e.g. "DKK". Null means the currency the offers are priced in. */
  max_price_currency: string | null;

  /** Null means economy. */
  cabin_class: CabinClass | null;
  /** Number of travellers, all searched as adults. Null means 1. */
  passengers: number | null;

  /** Moods the user asked for instead of a place, e.g. ["beaches"]. */
  vibe_tags: string[] | null;

  direct_only: boolean | null;
  /** 2-letter airline codes ("SK") or names ("SAS"). Empty means any airline. */
  preferred_airlines: string[] | null;
  baggage_required: boolean | null;
  departure_time: DepartureTime | null;

  /** Rooms to book. Null means two travellers to a room. */
  hotel_rooms: number | null;
  /** The most one night may cost, as the user said it, e.g. 150. */
  hotel_max_price: number | null;
  /** ISO 4217 code of that limit. Null means the currency the hotels are priced in. */
  hotel_max_price_currency: string | null;
  /** Fewest stars the hotel may have, 1 to 5. */
  hotel_min_stars: number | null;
  hotel_free_cancellation: boolean | null;
  /** What the hotel must have. Empty means nothing in particular. */
  hotel_amenities: HotelAmenity[] | null;

  // Set when the user names a country, continent or region rather than a city.
  destination_country: string | null;
  /** 2-letter ISO country code, or "EU" for Europe as a whole. */
  destination_country_code: string | null;
  /** 2-letter continent code, e.g. "EU", "AS". */
  destination_continent_code: string | null;
  /** A region or direction, e.g. "south of Spain". */
  destination_area: string | null;

  /**
   * Not part of the schema: the backend adds this when it picks an airport on
   * the user's behalf ("Since you want beaches, I selected …"). May contain **bold**.
   */
  explanation?: string | null;
};
