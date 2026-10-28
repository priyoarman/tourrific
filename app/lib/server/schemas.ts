import { z } from "zod";
import { addDays } from "../destinations.ts";
import { MAX_PROMPT_LENGTH } from "../limits.ts";
import type { Airline, FlightOffer, FlightSlice, Hotel } from "../types";
import type { StreamHotels } from "../types/stream-events";

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
  departure_time: z
    .string()
    .refine((value) => !Number.isNaN(new Date(value).getTime()), "Invalid datetime format")
    .transform((value) => new Date(value)),
  currency_id: z.number().int().optional().nullable(),
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

const tripQuerySchema = z.object({
  trip_type: z.enum(["one_way", "return"]).nullish(),
  origin_airport: shortText.nullish(),
  destination_airport: shortText.nullish(),
  departure_date: z.iso.date().nullish(),
  return_date: z.iso.date().nullish(),
  stay_length: z.number().int().min(1).max(99).nullish(),
  stay_unit: z.enum(["days", "nights", "weeks"]).nullish(),
  max_price: z.number().positive().max(10_000_000).nullish(),
  max_price_currency: z.string().max(3).nullish(),
  cabin_class: z.enum(["economy", "premium_economy", "business", "first"]).nullish(),
  passengers: z.number().int().min(1).max(9).nullish(),
  vibe_tags: tagList.nullish(),
  direct_only: z.boolean().nullish(),
  preferred_airlines: tagList.nullish(),
  baggage_required: z.boolean().nullish(),
  departure_time: z.enum(["morning", "afternoon", "evening", "night"]).nullish(),
  hotel_rooms: z.number().int().min(1).max(9).nullish(),
  hotel_max_price: z.number().positive().max(10_000_000).nullish(),
  hotel_max_price_currency: z.string().max(3).nullish(),
  hotel_min_stars: z.number().int().min(1).max(5).nullish(),
  hotel_free_cancellation: z.boolean().nullish(),
  hotel_amenities: z
    .array(z.enum(["wifi", "pool", "spa", "gym", "parking", "restaurant", "room_service", "pet_friendly"]))
    .max(8)
    .nullish(),
  destination_country: shortText.nullish(),
  destination_country_code: z.string().max(3).nullish(),
  destination_continent_code: z.string().max(3).nullish(),
  destination_area: z.string().max(100).nullish(),
  explanation: z.string().max(500).nullish(),
});

export const searchStreamSchema = z.object({
  prompt: z.string().trim().min(1, "Missing prompt.").max(MAX_PROMPT_LENGTH),
  page: z.number().int().min(1).max(1000).optional(),
  limit: z.literal("all").optional(),
  context: z
    .object({
      destination: shortText.nullish(),
      tripQuery: tripQuerySchema.nullish(),
      awaiting: z.enum(["return_date", "departure_date"]).nullish(),
    })
    .nullish(),
});

const airportCode = z.string().regex(/^[A-Z]{3}$/);
const currencyCode = z.string().regex(/^[A-Z]{3}$/);
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/);
const price = z.number().nonnegative().max(10_000_000);
const imageUrl = z.url({ protocol: /^https$/ }).max(500).nullable();
const minutes = z.number().int().nonnegative().max(14 * 24 * 60);

const airlineSchema = z.object({
  name: z.string().max(100),
  code: z.string().max(3),
  logoUrl: imageUrl,
}) satisfies z.ZodType<Airline>;

const flightSliceSchema = z.object({
  origin: airportCode,
  destination: airportCode,
  departureTime: localDateTime,
  arrivalTime: localDateTime,
  durationMinutes: minutes,
  stops: z.array(z.object({ airport: airportCode, layoverMinutes: minutes })).max(10),
}) satisfies z.ZodType<FlightSlice>;

const flightOfferSchema = z.object({
  id: z.string().max(100),
  airline: airlineSchema,
  flightNumber: z.string().max(10),
  outbound: flightSliceSchema,
  inbound: flightSliceSchema.nullable(),
  totalPrice: price,
  currency: currencyCode,
  cabin: z.string().max(60),
  fareBrand: z.string().max(100).nullable(),
  baggage: z.string().max(200),
}) satisfies z.ZodType<FlightOffer>;

const hotelSchema = z.object({
  id: z.string().max(100),
  name: z.string().max(200),
  area: z.string().max(300),
  distanceKm: z.number().nonnegative().max(1000).nullable(),
  stars: z.number().min(0).max(5).nullable(),
  rating: z.number().min(0).max(10).nullable(),
  reviewCount: z.number().int().nonnegative().nullable(),
  nightlyPrice: price,
  currency: currencyCode,
  amenities: z.array(z.string().max(60)).max(30),
  photoUrl: imageUrl,
  gradient: z.string().regex(/^[a-z0-9 :/\[\]#.-]{0,200}$/),
  freeCancellation: z.boolean(),
}) satisfies z.ZodType<Hotel>;

const staySchema = z.object({
  city: z.string().max(100).nullable(),
  around: z.enum(["city", "airport"]),
  checkIn: z.iso.date(),
  checkOut: z.iso.date(),
  nights: z.number().int().min(1).max(99),
  nightsAssumed: z.boolean(),
  guests: z.number().int().min(1).max(9),
  rooms: z.number().int().min(1).max(9),
}) satisfies z.ZodType<StreamHotels["stay"]>;

export const pickedTripSchema = z
  .object({
    flight: flightOfferSchema,
    hotel: hotelSchema,
    stay: staySchema,
    sample: z.boolean().optional(),
  })
  .superRefine(({ flight, stay }, ctx) => {
    if (addDays(stay.checkIn, stay.nights) !== stay.checkOut) {
      ctx.addIssue({ code: "custom", path: ["stay", "checkOut"], message: "Check-out must be `nights` after check-in" });
    }
    if (flight.outbound.departureTime.slice(0, 10) !== stay.checkIn) {
      ctx.addIssue({ code: "custom", path: ["stay", "checkIn"], message: "Check-in must be the day the flight leaves" });
    }
    if (flight.inbound && flight.inbound.departureTime.slice(0, 10) !== stay.checkOut) {
      ctx.addIssue({ code: "custom", path: ["stay", "checkOut"], message: "Check-out must be the day the return flight leaves" });
    }
  });
