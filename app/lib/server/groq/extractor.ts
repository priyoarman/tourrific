import { createGroq } from "@ai-sdk/groq";
import type { CabinClass, DepartureTime, HotelAmenity, StayUnit, TripQuery, TripType } from "../../types/trip-query";
import { resolveDestination } from "../destination-resolver.ts";
import TRIP_QUERY_SCHEMA from "./schema.ts";
import SYSTEM_PROMPT from "./system-prompt.ts";

const DEFAULT_MODEL = "openai/gpt-oss-20b";
const DEFAULT_TIMEOUT_MS = 10_000;
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

function safeParseJsonMaybe(text: unknown): unknown {
  if (!text || typeof text !== "string") return null;
  try {
    return JSON.parse(text);
  } catch {
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

function normalizeStayUnit(value: unknown): StayUnit | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replace(/s$/, "");
  return ["day", "night", "week"].includes(normalized) ? (`${normalized}s` as StayUnit) : null;
}

function normalizeStay(length: unknown, unit: unknown) {
  const stay_length = normalizeCount(length, 1, 99);
  const stay_unit = normalizeStayUnit(unit);
  return stay_length && stay_unit ? { stay_length, stay_unit } : { stay_length: null, stay_unit: null };
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

function normalizeCount(value: unknown, min: number, max: number) {
  const count = typeof value === "string" ? Number.parseInt(value, 10) : value;
  return typeof count === "number" && Number.isFinite(count) && count >= min ? Math.min(Math.round(count), max) : null;
}

const AMENITY_WORDS: [HotelAmenity, RegExp][] = [
  ["wifi", /wi-?fi|internet/],
  ["pool", /pool/],
  ["spa", /\bspa\b|sauna|wellness/],
  ["gym", /gym|fitness/],
  ["parking", /parking|garage/],
  ["restaurant", /restaurant/],
  ["room_service", /room[\s_-]?service/],
  ["pet_friendly", /\bpets?\b|\bdogs?\b|pet[\s_-]?friendly/],
];

function normalizeAmenities(value: unknown): HotelAmenity[] {
  const named = normalizeStringList(value).map((item) => item.toLowerCase());
  return AMENITY_WORDS.filter(([, words]) => named.some((item) => words.test(item))).map(([amenity]) => amenity);
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
    ...normalizeStay(source.stay_length, source.stay_unit),
    max_price: normalizeMaxPrice(source.max_price),
    max_price_currency: normalizeMaxPrice(source.max_price) ? normalizeCurrency(source.max_price_currency) : null,
    cabin_class: normalizeCabinClass(source.cabin_class),
    passengers: normalizePassengers(source.passengers),
    vibe_tags: normalizeStringList(source.vibe_tags),
    direct_only: normalizeBoolean(source.direct_only),
    preferred_airlines: normalizeStringList(source.preferred_airlines),
    baggage_required: normalizeBoolean(source.baggage_required),
    departure_time: normalizeDepartureTime(source.departure_time),

    hotel_rooms: normalizeCount(source.hotel_rooms, 1, 9),
    hotel_max_price: normalizeMaxPrice(source.hotel_max_price),
    hotel_max_price_currency: normalizeMaxPrice(source.hotel_max_price) ? normalizeCurrency(source.hotel_max_price_currency) : null,
    hotel_min_stars: normalizeCount(source.hotel_min_stars, 1, 5),
    hotel_free_cancellation: normalizeBoolean(source.hotel_free_cancellation),
    hotel_amenities: normalizeAmenities(source.hotel_amenities),
  };
}

const COUNT_WORDS = ["a", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen"];

type StayLength = { stay_length: number | null; stay_unit: StayUnit | null };

export function parseStayLength(text: unknown): StayLength {
  const none = { stay_length: null, stay_unit: null };
  if (typeof text !== "string") return none;

  const count = `\\d{1,2}|${COUNT_WORDS.join("|")}|an`;
  const pattern = new RegExp(`(?:\\b(in|within|after|next)\\s+)?\\b(${count})[\\s-]+(day|night|week)s?\\b(\\s+(?:from now|later|ahead|ago))?`, "g");
  const normalized = text.toLowerCase();
  for (const [, before, amount, unit, after] of normalized.matchAll(pattern)) {
    if (before || after) continue;
    const length = /^\d/.test(amount) ? Number(amount) : Math.max(COUNT_WORDS.indexOf(amount), 1);
    return normalizeStay(length, unit);
  }

  if (/\bweekend\s+(?:in|at|away|trip|getaway|break)\b|\b(?:for|spend|spending)\s+(?:a|the)\s+weekend\b/.test(normalized)) {
    return { stay_length: 2, stay_unit: "days" };
  }
  return none;
}

export function saysOneWay(text: unknown) {
  return typeof text === "string" && /\bone[\s-]?way\b|\bno return\b/i.test(text);
}

export function asksForWayBack(text: unknown) {
  if (typeof text !== "string" || saysOneWay(text)) return false;
  return /\bround[\s-]?trip\b|\breturn\s+(?:trip|flight|ticket)s?\b|\bthere and back\b/i.test(text);
}

export type ExtractionResult =
  | { ok: true; parsed: TripQuery; errors: string[] }
  | { ok: false; parsed: null; errors: string[] };

type Options = {
  modelId?: string;
  referenceDate?: Date;
  signal?: AbortSignal;
  datesFrom?: string | null;
};

export async function extractTripQuery(userText: string, opts: Options = {}): Promise<ExtractionResult> {
  const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
  const model = groq.languageModel(opts.modelId || process.env.GROQ_MODEL || DEFAULT_MODEL);

  const referenceDate = opts.referenceDate || new Date();
  const currentDate = toDateOnlyString(startOfToday(referenceDate));
  const datesText = opts.datesFrom === undefined ? userText : opts.datesFrom;
  const localDates = parseNaturalTravelDates(datesText, referenceDate);
  const prompt = [
    { role: "system" as const, content: SYSTEM_PROMPT.replace("{{CURRENT_DATE}}", currentDate) },
    { role: "user" as const, content: [{ type: "text" as const, text: userText }] },
  ];

  const timeout = AbortSignal.timeout(Number(process.env.GROQ_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS);
  const abortSignal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
  const givenUp = (error: unknown) => {
    if (opts.signal?.aborted) return "cancelled";
    if (timeout.aborted) return "timeout";
    return (error as { statusCode?: number }).statusCode === 429 ? "rate_limited" : null;
  };
  const failed = (reason: string, error: unknown): ExtractionResult => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Groq generation failed (${reason}):`, message);
    return { ok: false, parsed: null, errors: [reason, message] };
  };

  let response;
  try {
    response = await model.doGenerate({
      prompt,
      abortSignal,
      responseFormat: {
        type: "json",
        name: "trip_query_extraction",
        description: "Extract a flight search query, and any wishes for the hotel, from natural language.",
        schema: TRIP_QUERY_SCHEMA as unknown as Record<string, never>,
      },
      maxOutputTokens: 1024,
    });
  } catch (error) {
    const reason = givenUp(error);
    if (reason) return failed(reason, error);

    console.warn(
      "Groq structured generation failed; retrying without schema validation:",
      error instanceof Error ? error.message : error,
    );

    try {
      response = await model.doGenerate({ prompt, abortSignal, maxOutputTokens: 1024 });
    } catch (retryError) {
      return failed(givenUp(retryError) ?? "failed_generation", retryError);
    }
  }

  const textPart = response.content.find((part) => part.type === "text");
  let raw = textPart?.type === "text" ? safeParseJsonMaybe(textPart.text) : null;

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
  if (!parsed.stay_length) Object.assign(parsed, parseStayLength(datesText));
  parsed.trip_type = normalizeTripType(parsed.trip_type, parsed.return_date);
  if (asksForWayBack(datesText)) parsed.trip_type = "return";

  const resolved = resolveDestination(parsed);
  if (resolved.destination_airport) {
    parsed.destination_airport = resolved.destination_airport;
    parsed.explanation = resolved.explanation;
  } else {
    parsed.explanation = null;
  }

  return { ok: true, parsed, errors: [] };
}
