// What each endpoint accepts. Ported from api/src/schemas/.
import { z } from "zod";

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
