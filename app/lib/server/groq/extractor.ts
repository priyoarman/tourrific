// Asks Groq to turn a chat message into a structured flight search (a
// TripQuery), then tidies the answer. Ported from api/src/groq/extractor.js.
import { createGroq } from "@ai-sdk/groq";
import type { CabinClass, DepartureTime, TripQuery, TripType } from "../../types/trip-query";
import { resolveDestination } from "../destination-resolver.ts";
import TRIP_QUERY_SCHEMA from "./schema.ts";
import SYSTEM_PROMPT from "./system-prompt.ts";

const DEFAULT_MODEL = "openai/gpt-oss-20b";
const MONTH_NAMES = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
const WEEKDAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** Parses the model's answer, which may wrap the JSON in other text. */
function safeParseJsonMaybe(text: unknown): unknown {
  if (!text || typeof text !== "string") return null;
  try {
    return JSON.parse(text);
  } catch {
    // Fall back to the first {...} block in the text.
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizeIataCode(value: unknown) {
  if (typeof value !== "string" || value.trim() === "") return null;
  return value.trim().toUpperCase();
}

function normalizeTripType(value: unknown, returnDate: unknown): TripType {
  if (returnDate) return "return";
  if (typeof value !== "string" || value.trim() === "") return "one_way";

  const normalized = value.trim().toLowerCase().replace(/[-\s]/g, "_");
  if (["return", "round_trip", "roundtrip"].includes(normalized)) return "return";
  if (["one_way", "oneway", "single"].includes(normalized)) return "one_way";

  // The Express version passed unknown values through; none of them ever meant a return trip.
  return "one_way";
}

function normalizeBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();
  if (["true", "yes", "y", "only", "direct", "nonstop", "non-stop"].includes(normalized)) return true;
  if (["false", "no", "n"].includes(normalized)) return false;
  return null;
}

function normalizeStringList(value: unknown) {
  if (value == null || value === "") return [];
  const items = Array.isArray(value) ? value : String(value).split(/[,\n]/);
  return items.map((item) => String(item).trim()).filter(Boolean);
}

function normalizeDepartureTime(value: unknown): DepartureTime | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return ["morning", "afternoon", "evening", "night"].includes(normalized)
    ? (normalized as DepartureTime)
    : null;
}

function normalizeCabinClass(value: unknown): CabinClass | null {
  if (typeof value !== "string") return null;
  const aliases: Record<string, CabinClass> = {
    economy: "economy",
    coach: "economy",
    premium: "premium_economy",
    premium_economy: "premium_economy",
    business: "business",
    business_class: "business",
    first: "first",
    first_class: "first",
  };
  return aliases[value.trim().toLowerCase().replace(/[-\s]/g, "_")] ?? null;
}

/** A whole number of travellers from 1 to 9, or null. */
function normalizePassengers(value: unknown) {
  const count = typeof value === "string" ? Number.parseInt(value, 10) : value;
  return typeof count === "number" && Number.isFinite(count) && count >= 1 ? Math.min(Math.round(count), 9) : null;
}

function normalizeMaxPrice(value: unknown) {
  const price = typeof value === "string" ? Number.parseFloat(value.replace(/[^\d.]/g, "")) : value;
  return typeof price === "number" && Number.isFinite(price) && price > 0 ? price : null;
}

const CURRENCY_ALIASES: Record<string, string> = { "€": "EUR", EURO: "EUR", EUROS: "EUR", $: "USD", "£": "GBP", KR: "DKK", "KR.": "DKK", KRONER: "DKK" };

function normalizeCurrency(value: unknown) {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return CURRENCY_ALIASES[code] ?? (/^[A-Z]{3}$/.test(code) ? code : null);
}

const stringOrNull = (value: unknown) => (typeof value === "string" && value ? value : null);

function toDateOnlyString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function startOfToday(referenceDate = new Date()) {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);
  return today;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function nextWeekday(referenceDate: Date, weekdayIndex: number, { includeToday = false } = {}) {
  const today = startOfToday(referenceDate);
  let offset = (weekdayIndex - today.getDay() + 7) % 7;
  if (offset === 0 && !includeToday) offset = 7;

  return addDays(today, offset);
}

function saturdayForWeekend(referenceDate: Date, modifier: string) {
  const upcomingSaturday = nextWeekday(referenceDate, 6, { includeToday: true });
  return modifier === "next" ? addDays(upcomingSaturday, 7) : upcomingSaturday;
}

function hashText(value: string) {
  return Array.from(value).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0);
}

/** A day in the given month that hasn't passed. The same text always picks the same day. */
function futureDateInMonth(monthIndex: number, year: number, referenceDate: Date, seedText: string) {
  const today = startOfToday(referenceDate);
  const firstOfMonth = new Date(year, monthIndex, 1);
  const lastOfMonth = new Date(year, monthIndex + 1, 0);
  const start = firstOfMonth < today ? today : firstOfMonth;

  if (start > lastOfMonth) return null;

  const daySpan = lastOfMonth.getDate() - start.getDate() + 1;
  return addDays(start, hashText(seedText) % daySpan);
}

type TravelDates = { departure_date: string | null; return_date: string | null };

/**
 * Works out dates the model tends to get wrong ("tomorrow", "next Friday",
 * "this weekend", a bare month) with plain date arithmetic. What it finds
 * overrides the model's answer.
 */
export function parseNaturalTravelDates(text: unknown, referenceDate = new Date()): TravelDates {
  if (typeof text !== "string" || text.trim() === "") {
    return { departure_date: null, return_date: null };
  }

  const normalized = text.toLowerCase();
  const today = startOfToday(referenceDate);
  const departing = (date: Date | null): TravelDates => ({
    departure_date: date ? toDateOnlyString(date) : null,
    return_date: null,
  });

  if (/\btomorrow\b/.test(normalized)) return departing(addDays(today, 1));

  const weekendMatch = normalized.match(/\b(this|next)?\s*weekend\b/);
  if (weekendMatch) return departing(saturdayForWeekend(today, weekendMatch[1] || "this"));

  const weekdayMatch = normalized.match(new RegExp(`\\b(this|next)?\\s*(${WEEKDAY_NAMES.join("|")})\\b`));
  if (weekdayMatch) {
    const weekdayIndex = WEEKDAY_NAMES.indexOf(weekdayMatch[2]);
    return departing(nextWeekday(today, weekdayIndex, { includeToday: weekdayMatch[1] === "this" }));
  }

  const monthMatch = normalized.match(new RegExp(`\\b(${MONTH_NAMES.join("|")})\\b(?:\\s+(20\\d{2}))?`));
  if (monthMatch && !/\b\d{1,2}\s+(?:of\s+)?[a-z]+|[a-z]+\s+\d{1,2}\b/.test(normalized)) {
    const monthIndex = MONTH_NAMES.indexOf(monthMatch[1]);
    let year = monthMatch[2] ? Number(monthMatch[2]) : today.getFullYear();
    if (!monthMatch[2] && monthIndex < today.getMonth()) year += 1;

    return departing(futureDateInMonth(monthIndex, year, today, normalized));
  }

  return { departure_date: null, return_date: null };
}

/** Cleans up whatever the model returned into a well-formed TripQuery. */
export function normalizeTripQuery(raw: unknown): TripQuery {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  return {
    origin_airport: normalizeIataCode(source.origin_airport),
    destination_airport: normalizeIataCode(source.destination_airport),
    destination_country: stringOrNull(source.destination_country),
    destination_country_code: normalizeIataCode(source.destination_country_code),
    destination_continent_code: normalizeIataCode(source.destination_continent_code),
    destination_area: stringOrNull(source.destination_area),

    departure_date: stringOrNull(source.departure_date),

    trip_type: normalizeTripType(source.trip_type, source.return_date),
    return_date: stringOrNull(source.return_date),
    max_price: normalizeMaxPrice(source.max_price),
    max_price_currency: normalizeMaxPrice(source.max_price) ? normalizeCurrency(source.max_price_currency) : null,
    cabin_class: normalizeCabinClass(source.cabin_class),
    passengers: normalizePassengers(source.passengers),
    vibe_tags: normalizeStringList(source.vibe_tags),
    direct_only: normalizeBoolean(source.direct_only),
    preferred_airlines: normalizeStringList(source.preferred_airlines),
    baggage_required: normalizeBoolean(source.baggage_required),
    departure_time: normalizeDepartureTime(source.departure_time),
  };
}

export type ExtractionResult =
  | { ok: true; parsed: TripQuery; errors: string[] }
  | { ok: false; parsed: null; errors: string[] };

type Options = { modelId?: string; referenceDate?: Date };

/**
 * Sends the text to Groq and returns the flight search it describes.
 * `ok: false` means the model could not be reached or didn't answer in JSON.
 */
export async function extractTripQuery(userText: string, opts: Options = {}): Promise<ExtractionResult> {
  const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
  const model = groq.languageModel(opts.modelId || process.env.GROQ_MODEL || DEFAULT_MODEL);

  const referenceDate = opts.referenceDate || new Date();
  const currentDate = toDateOnlyString(startOfToday(referenceDate));
  const localDates = parseNaturalTravelDates(userText, referenceDate);
  const prompt = [
    { role: "system" as const, content: SYSTEM_PROMPT.replace("{{CURRENT_DATE}}", currentDate) },
    { role: "user" as const, content: [{ type: "text" as const, text: userText }] },
  ];

  let response;
  try {
    // The AI SDK maps this to Groq's structured outputs (response_format: json_schema).
    response = await model.doGenerate({
      prompt,
      responseFormat: {
        type: "json",
        name: "trip_query_extraction",
        description: "Extract a flight search query from natural language.",
        // The schema is a readonly literal; the SDK's type wants a mutable one.
        schema: TRIP_QUERY_SCHEMA as unknown as Record<string, never>,
      },
      // Room for the model to finish the JSON.
      maxOutputTokens: 1024,
    });
  } catch (error) {
    console.warn(
      "Groq structured generation failed; retrying without schema validation:",
      error instanceof Error ? error.message : error,
    );

    try {
      response = await model.doGenerate({ prompt, maxOutputTokens: 1024 });
    } catch (retryError) {
      const message = retryError instanceof Error ? retryError.message : String(retryError);
      console.error("Groq generation failed:", message);
      return { ok: false, parsed: null, errors: ["failed_generation", message] };
    }
  }

  const textPart = response.content.find((part) => part.type === "text");
  let raw = textPart?.type === "text" ? safeParseJsonMaybe(textPart.text) : null;

  // Some providers put the parsed result on the raw response body instead.
  if (!raw && response.response?.body) {
    const body = response.response.body;
    raw = typeof body === "string" ? safeParseJsonMaybe(body) : body;
  }

  if (!raw || typeof raw !== "object") {
    return { ok: false, parsed: null, errors: ["failed_to_parse_json_from_model_response"] };
  }

  const parsed = normalizeTripQuery(raw);

  if (localDates.departure_date) parsed.departure_date = localDates.departure_date;
  if (localDates.return_date) parsed.return_date = localDates.return_date;
  parsed.trip_type = normalizeTripType(parsed.trip_type, parsed.return_date);

  // A country, region or mood becomes one specific airport, with a line explaining the pick.
  const resolved = resolveDestination(parsed);
  if (resolved.destination_airport) {
    parsed.destination_airport = resolved.destination_airport;
    parsed.explanation = resolved.explanation;
  } else {
    parsed.explanation = null;
  }

  return { ok: true, parsed, errors: [] };
}
