// Understands a message that revises the previous search ("a little later",
// "somewhere else", "further south") and merges it into that search.
// Ported from api/src/controllers/flightSearchStream.js.
import type { TripQuery } from "../types/trip-query";

const DESTINATION_EDIT =
  /\b(somewhere else|somewhere other|other than|another place|different place|different destination|elsewhere|more\s+(south|north|east|west)|a little\s+(south|north|east|west)|further\s+(south|north|east|west))\b/i;
const SOMEWHERE_ELSE =
  /\b(somewhere else|somewhere other|other than|another place|different place|different destination|elsewhere)\b/i;
const DATE_EDIT = /\b(later|earlier|sooner|another date|other date|different date|some other date|same place|there)\b/i;
const OTHER_DATE = /\b(another date|other date|different date|some other date)\b/i;
const EXPLICIT_DATE =
  /(\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b|\b(?:tomorrow|today|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b)/i;

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Reads "2026-11-12" as local midnight of that day, not UTC. */
export function parseDateOnly(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date(value);

  const [, year, month, day] = match.map(Number);
  return new Date(year, month - 1, day);
}

function toDateOnlyString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDaysToDateString(value: string | null, days: number) {
  if (!value) return null;

  const date = parseDateOnly(value);
  if (Number.isNaN(date.getTime())) return value;

  date.setDate(date.getDate() + days);
  return toDateOnlyString(date);
}

function hasUsefulValue(value: unknown) {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim() !== "";
  return true;
}

/** True when the message asks for a different place than last time. */
export function mentionsDestinationEdit(prompt: string) {
  return DESTINATION_EDIT.test(prompt);
}

function directionFromPrompt(prompt: string) {
  const match = prompt.match(/\b(?:more|further|a little|slightly)?\s*(south|north|east|west)\b/i);
  return match?.[1]?.toLowerCase() || null;
}

function broadDestinationName(tripQuery: TripQuery) {
  return (
    tripQuery.destination_country ||
    (tripQuery.destination_country_code === "EU" ? "Europe" : null) ||
    (tripQuery.destination_continent_code === "EU" ? "Europe" : null) ||
    "the previous area"
  );
}

function shiftDates(query: TripQuery, days: number) {
  query.departure_date = addDaysToDateString(query.departure_date, days);
  if (query.return_date) query.return_date = addDaysToDateString(query.return_date, days);
}

/**
 * Combines the newly extracted search with the previous one when the message
 * is a follow-up. Fields the new message didn't mention keep their old values.
 * Any other message returns `extracted` untouched.
 */
export function mergeFollowUpTripQuery(extracted: TripQuery, previous: TripQuery | null, userPrompt: string): TripQuery {
  const isFollowUp = previous && (mentionsDestinationEdit(userPrompt) || DATE_EDIT.test(userPrompt));
  if (!isFollowUp) return extracted;

  const merged: TripQuery = { ...previous };
  for (const [key, value] of Object.entries(extracted)) {
    if (hasUsefulValue(value)) (merged as Record<string, unknown>)[key] = value;
  }

  // "Further south" searches the southern part of wherever the last search was.
  const direction = directionFromPrompt(userPrompt);
  if (direction) {
    merged.destination_airport = null;
    merged.destination_area = `${direction} of ${broadDestinationName(merged)}`;
  }

  if (SOMEWHERE_ELSE.test(userPrompt)) merged.destination_airport = null;

  // "A little later" moves the trip by 3 days, plain "later" by a week.
  if (/\ba little later\b/i.test(userPrompt)) {
    shiftDates(merged, 3);
  } else if (/\blater\b/i.test(userPrompt) && !EXPLICIT_DATE.test(userPrompt)) {
    shiftDates(merged, 7);
  } else if (/\ba little (earlier|sooner)\b/i.test(userPrompt)) {
    shiftDates(merged, -3);
  } else if (/\b(earlier|sooner)\b/i.test(userPrompt) && !EXPLICIT_DATE.test(userPrompt)) {
    shiftDates(merged, -7);
  }

  // "Another date" without naming one: forget the dates, so the assistant asks for them.
  if (OTHER_DATE.test(userPrompt) && !extracted.departure_date && !/\b(later|earlier|sooner)\b/i.test(userPrompt)) {
    merged.departure_date = null;
    merged.return_date = null;
  }

  merged.trip_type = merged.return_date ? "return" : merged.trip_type || "one_way";
  return merged;
}
