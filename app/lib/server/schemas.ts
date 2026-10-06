// What each endpoint accepts. Ported from api/src/schemas/.
import { z } from "zod";
import { MAX_PROMPT_LENGTH } from "../limits.ts";

export const signupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const saveFlightSchema = z.object({
  flight_number: z.string().min(1),
  origin: z.string().length(3),
  destination: z.string().length(3),
  price: z.coerce.number().positive(),
  // An ISO date-time, with or without a time zone.
  departure_time: z
    .string()
    .refine((value) => !Number.isNaN(new Date(value).getTime()), "Invalid datetime format")
    .transform((value) => new Date(value)),
  currency_id: z.number().int().optional().nullable(),
  // ISO 4217 code, e.g. "EUR". Used when no currency_id is sent.
  currency_code: z.string().length(3).toUpperCase().optional().nullable(),
  airline_code: z.string().max(3).optional().nullable(),
  airline_name: z.string().optional().nullable(),
});

export const messageSchema = z.object({
  senderRole: z.enum(["user", "assistant"]),
  textContent: z.string().min(1).max(10_000),
});

export const searchFlightsSchema = z.object({
  slices: z.array(
    z.object({
      origin: z.string(),
      destination: z.string(),
      departure_date: z.string(),
    }),
  ),
  passengers: z.array(z.object({ type: z.enum(["adult", "child", "infant"]) })),
  cabin_class: z.string(),
});

const shortText = z.string().max(60);
const tagList = z.array(z.string().max(40)).max(10);

/**
 * The previous search, as the browser sends it back with a follow-up. It ends
 * up in the Groq prompt, so every field is bounded and unknown fields are dropped.
 */
const tripQuerySchema = z.object({
  trip_type: z.enum(["one_way", "return"]).nullish(),
  origin_airport: shortText.nullish(),
  destination_airport: shortText.nullish(),
  departure_date: z.iso.date().nullish(),
  return_date: z.iso.date().nullish(),
  max_price: z.number().positive().max(10_000_000).nullish(),
  max_price_currency: z.string().max(3).nullish(),
  cabin_class: z.enum(["economy", "premium_economy", "business", "first"]).nullish(),
  passengers: z.number().int().min(1).max(9).nullish(),
  vibe_tags: tagList.nullish(),
  direct_only: z.boolean().nullish(),
  preferred_airlines: tagList.nullish(),
  baggage_required: z.boolean().nullish(),
  departure_time: z.enum(["morning", "afternoon", "evening", "night"]).nullish(),
  destination_country: shortText.nullish(),
  destination_country_code: z.string().max(3).nullish(),
  destination_continent_code: z.string().max(3).nullish(),
  destination_area: z.string().max(100).nullish(),
  explanation: z.string().max(500).nullish(),
});

/** The body of POST /api/flights/search-stream (SearchStreamRequest). */
export const searchStreamSchema = z.object({
  prompt: z.string().trim().min(1, "Missing prompt.").max(MAX_PROMPT_LENGTH),
  page: z.number().int().min(1).max(1000).optional(),
  limit: z.literal("all").optional(),
  context: z
    .object({
      destination: shortText.nullish(),
      tripQuery: tripQuerySchema.nullish(),
    })
    .nullish(),
});
