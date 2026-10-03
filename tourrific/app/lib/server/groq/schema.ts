// The JSON Schema the model must answer in. The TripQuery type in
// app/lib/types/trip-query.ts mirrors it. Ported from api/src/groq/schema.json.
const TRIP_QUERY_SCHEMA = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "TripQuery",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "trip_type",
    "origin_airport",
    "destination_airport",
    "departure_date",
    "return_date",
    "max_price",
    "max_price_currency",
    "cabin_class",
    "passengers",
    "vibe_tags",
    "direct_only",
    "preferred_airlines",
    "baggage_required",
    "departure_time",
    "destination_country",
    "destination_country_code",
    "destination_continent_code",
    "destination_area"
  ],
  "properties": {
    "trip_type": { "type": ["string", "null"] },
    "origin_airport": { "type": ["string", "null"] },
    "destination_airport": { "type": ["string", "null"] },
    "departure_date": { "type": ["string", "null"] },
    "return_date": { "type": ["string", "null"] },
    "max_price": { "type": ["number", "null"] },
    "max_price_currency": { "type": ["string", "null"] },
    "cabin_class": { "type": ["string", "null"] },
    "passengers": { "type": ["integer", "null"] },
    "vibe_tags": { "type": ["array", "null"], "items": { "type": "string" } },
    "direct_only": { "type": ["boolean", "null"] },
    "preferred_airlines": { "type": ["array", "null"], "items": { "type": "string" } },
    "baggage_required": { "type": ["boolean", "null"] },
    "departure_time": { "type": ["string", "null"] },
    "destination_country": { "type": ["string", "null"] },
    "destination_country_code": { "type": ["string", "null"] },
    "destination_continent_code": { "type": ["string", "null"] },
    "destination_area": { "type": ["string", "null"] }
  }
} as const;
export default TRIP_QUERY_SCHEMA;
