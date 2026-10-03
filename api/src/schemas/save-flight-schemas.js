import { z } from "zod";

export const saveFlightSchema = z.object({
  flight_number: z.string().min(1),

  origin: z.string().length(3),

  destination: z.string().length(3),

  price: z.coerce.number().positive(),

  departure_time: z.string().transform((str) => {
    // Accept ISO datetime with or without timezone and milliseconds
    const date = new Date(str);
    if (isNaN(date.getTime())) {
      throw new Error("Invalid datetime format");
    }
    return date.toISOString();
  }),

  currency_id: z.number().int().optional().nullable(),

  // ISO 4217 code, e.g. "EUR". Used when no currency_id is sent.
  currency_code: z.string().length(3).toUpperCase().optional().nullable(),

  airline_code: z.string().max(3).optional().nullable(),

  airline_name: z.string().optional().nullable(),
});
