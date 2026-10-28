export type TripType = "one_way" | "return";

export type DepartureTime = "morning" | "afternoon" | "evening" | "night";

export type CabinClass = "economy" | "premium_economy" | "business" | "first";

export type StayUnit = "days" | "nights" | "weeks";

export type HotelAmenity = "wifi" | "pool" | "spa" | "gym" | "parking" | "restaurant" | "room_service" | "pet_friendly";

export type TripQuery = {
  trip_type: TripType | null;

  origin_airport: string | null;
  destination_airport: string | null;

  departure_date: string | null;
  return_date: string | null;
  stay_length: number | null;
  stay_unit: StayUnit | null;

  max_price: number | null;
  max_price_currency: string | null;

  cabin_class: CabinClass | null;
  passengers: number | null;

  vibe_tags: string[] | null;

  direct_only: boolean | null;
  preferred_airlines: string[] | null;
  baggage_required: boolean | null;
  departure_time: DepartureTime | null;

  hotel_rooms: number | null;
  hotel_max_price: number | null;
  hotel_max_price_currency: string | null;
  hotel_min_stars: number | null;
  hotel_free_cancellation: boolean | null;
  hotel_amenities: HotelAmenity[] | null;

  destination_country: string | null;
  destination_country_code: string | null;
  destination_continent_code: string | null;
  destination_area: string | null;

  explanation?: string | null;
};
