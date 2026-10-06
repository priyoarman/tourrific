// The chat's flight search: one message in, a series of events out (progress
// lines, questions, and finally the flights).
// Ported from api/src/controllers/flightSearchStream.js.
import type { DuffelOffer } from "../types/duffel";
import type { SearchContext, StreamEventMap, StreamEventName } from "../types/stream-events";
import type { TripQuery } from "../types/trip-query";
import { compactOffer } from "./compact-offer.ts";
import { resolveDestination, resolveDestinationAirportInput } from "./destination-resolver.ts";
import { DuffelTimeout, searchFlightsCached, type DuffelSearchSlice } from "./duffel.ts";
import { duffelSearchOptions, filterOffers, passengerCount } from "./flight-filters.ts";
import { isPlainObject, mentionsDestinationEdit, mergeFollowUpTripQuery, parseDateOnly } from "./follow-up.ts";
import { extractTripQuery } from "./groq/extractor.ts";
import { detectFallbackOrigin } from "./origin-fallback.ts";

const PAGE_SIZE = 7;

/** Sends one event to the browser. */
export type SendEvent = <K extends StreamEventName>(event: K, data: StreamEventMap[K]) => void;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** What the visitor is told when Groq can't turn their message into a search. */
const EXTRACTION_PROBLEMS: Record<string, string> = {
  timeout: "My AI travel service is taking too long to answer. Please try again in a moment.",
  rate_limited: "Usage limit reached. Please wait a few minutes and try again.",
};
const EXTRACTION_PROBLEM = "I'm having trouble connecting to my AI travel service. Please try again in a moment.";

function isReturnTrip(extracted: TripQuery) {
  return extracted.trip_type === "return" || Boolean(extracted.return_date);
}

function buildSearchSlices(extracted: TripQuery, destination: string) {
  const origin = extracted.origin_airport || null;
  const outbound: DuffelSearchSlice = { destination, departure_date: extracted.departure_date };
  if (origin) outbound.origin = origin;

  const slices = [outbound];

  if (extracted.return_date) {
    const inbound: DuffelSearchSlice = { origin: destination, departure_date: extracted.return_date };
    if (origin) inbound.destination = origin;
    slices.push(inbound);
  }

  return slices;
}

function buildSearchStatusMessages(extracted: TripQuery, returnTrip: boolean) {
  const origin = extracted.origin_airport || "your location";
  const messages = [
    `Searching ${returnTrip ? "return " : ""}flights from ${origin} to ${extracted.destination_airport}...`,
  ];

  const travellers = passengerCount(extracted);
  if (travellers > 1) messages.push(`Pricing it for ${travellers} travellers...`);
  if (extracted.cabin_class && extracted.cabin_class !== "economy") {
    messages.push(`Looking in ${extracted.cabin_class.replace("_", " ")}...`);
  }
  if (extracted.direct_only) messages.push("Checking direct routes...");
  if (extracted.baggage_required) messages.push("Filtering for flights with baggage included...");
  if (extracted.preferred_airlines?.length) {
    messages.push("Looking at the airlines you asked for...");
  }
  if (extracted.departure_time) messages.push(`Narrowing to ${extracted.departure_time} departures...`);
  if (extracted.max_price) messages.push("Keeping to your budget...");

  messages.push("Comparing prices across airlines...");
  return messages;
}

/**
 * Runs one search and reports it through `send`. Always finishes with a
 * `done` event (or a single `error` event when there is no prompt), and never
 * throws.
 *
 * `body` is the request's JSON. `headers` are only used to guess the
 * departure airport from the visitor's IP when the message doesn't name one.
 *
 * Aborting `signal` (the visitor left, or started a newer search) stops the
 * search where it is: calls to Groq and Duffel in progress are dropped, later
 * ones are never made, and nothing more is sent.
 */
export async function runFlightSearch(body: unknown, headers: Headers, send: SendEvent, signal?: AbortSignal) {
  const request = isPlainObject(body) ? body : {};
  const userPrompt = typeof request.prompt === "string" ? request.prompt.trim() : "";
  const context = (isPlainObject(request.context) ? request.context : {}) as SearchContext;
  const contextDestination = typeof context.destination === "string" ? context.destination : null;
  const previousTripQuery = isPlainObject(context.tripQuery) ? (context.tripQuery as TripQuery) : null;
  // `limit: "all"` returns every offer in one response, in a compact form, so the
  // client can sort and page locally instead of re-running the search per page.
  const sendAll = request.limit === "all";
  const page = sendAll ? 1 : Math.max(parseInt(String(request.page)) || 1, 1);

  if (!userPrompt) {
    send("error", { message: "Missing prompt." });
    return;
  }

  /** The assistant says something and waits for the visitor's answer. */
  const ask = (text: string, nextContext?: SearchContext) => {
    send("message", { text });
    send("done", nextContext ? { needsInput: true, context: nextContext } : { needsInput: true });
  };

  try {
    send("status", { text: " Understanding your request..." });
    await delay(300);

    const extractionPrompt = previousTripQuery
      ? `Previous flight search JSON: ${JSON.stringify(previousTripQuery)}\nUser message: ${userPrompt}\nIf the user message is a revision or follow-up, keep unchanged fields from the previous search and update only what the user changed.`
      : contextDestination
        ? `Context: The user previously mentioned wanting to fly to ${contextDestination}.\nUser message: ${userPrompt}`
        : userPrompt;

    const result = await extractTripQuery(extractionPrompt, { signal });
    if (signal?.aborted) return;
    if (!result.ok) {
      send("message", { text: EXTRACTION_PROBLEMS[result.errors[0]] ?? EXTRACTION_PROBLEM, isError: true });
      send("done", { needsInput: false });
      return;
    }

    const extracted = mergeFollowUpTripQuery({ ...result.parsed }, previousTripQuery, userPrompt);

    if (!extracted.origin_airport) {
      extracted.origin_airport = detectFallbackOrigin(headers);
    }

    if (!extracted.destination_airport) {
      const match = userPrompt.match(/to\s+([a-zA-Z\s]+)/i);
      if (match?.[1]) extracted.destination_airport = match[1].trim().toUpperCase();
    }

    if (!extracted.destination_airport) {
      const resolved = resolveDestination(extracted);
      if (resolved.destination_airport) {
        extracted.destination_airport = resolved.destination_airport;
        extracted.explanation = resolved.explanation;
      }
    }

    const destinationEdited = Boolean(previousTripQuery) && mentionsDestinationEdit(userPrompt);
    const destination = resolveDestinationAirportInput(
      extracted.destination_airport || (destinationEdited ? null : contextDestination),
    );

    if (extracted.explanation) {
      send("message", { text: extracted.explanation });
      await delay(300);
    }

    if (!destination) {
      ask("I'm a travel assistant. Where would you like to fly today?");
      return;
    }

    if (!extracted.departure_date) {
      ask("That's great. Could you please tell me when you'd like to travel?", { destination });
      return;
    }

    const returnTrip = isReturnTrip(extracted);

    if (returnTrip && !extracted.return_date) {
      ask(`Got it — a return trip to ${destination}. When would you like to come back?`, { destination });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const departureDate = parseDateOnly(extracted.departure_date);
    if (departureDate < today) {
      ask("I cannot search for flights in the past. Please provide a future date.");
      return;
    }

    if (extracted.return_date) {
      const returnDate = parseDateOnly(extracted.return_date);
      if (returnDate < today) {
        ask("The return date cannot be in the past. Please provide a future return date.");
        return;
      }
      if (returnDate < departureDate) {
        ask("The return date must be on or after your departure date.");
        return;
      }
    }

    extracted.destination_airport = destination;
    for (const text of buildSearchStatusMessages(extracted, returnTrip)) {
      send("status", { text: `${text} ` });
      await delay(400);
    }

    // Duffel narrows the search where it can; the rest is filtered once the offers are in.
    const { outboundDepartureTime, ...searchOptions } = duffelSearchOptions(extracted);
    const slices = buildSearchSlices(extracted, destination);
    if (outboundDepartureTime) slices[0].departure_time = outboundDepartureTime;

    if (signal?.aborted) return;
    const flights = await searchFlightsCached({ slices, ...searchOptions }, signal);
    const found: DuffelOffer[] = flights?.data?.offers ?? [];
    const { offers, labels, unfilteredCount } = filterOffers(found, extracted);
    const count = offers.length;

    const limit = sendAll ? Math.max(count, 1) : PAGE_SIZE;
    const start = (page - 1) * limit;
    const end = start + limit;

    if (count < unfilteredCount) {
      send("status", {
        text: `Found ${unfilteredCount} flight${unfilteredCount === 1 ? "" : "s"}, ${count || "none"} of them match${count === 1 ? "es" : ""} what you asked for.`,
      });
      await delay(300);
    } else if (count > 0) {
      send("status", { text: `Found ${count} possible flight${count === 1 ? "" : "s"}.` });
      await delay(300);
    } else {
      send("status", { text: "No flights found for those dates." });
      await delay(200);
    }

    send("complete", {
      destination,
      offers: sendAll ? offers.map(compactOffer) : offers.slice(start, end),
      extracted,
      pagination: {
        page,
        limit,
        totalOffers: count,
        totalPages: Math.max(Math.ceil(count / limit), 1),
        hasNextPage: end < count,
        hasPreviousPage: page > 1,
      },
      filters: { labels, unfilteredCount },
    });
    send("done", { needsInput: false });
  } catch (error) {
    if (signal?.aborted) return;

    console.error("Flight search failed:", error);
    const rateLimited = error instanceof Error && error.message.includes("Rate limit");
    send("message", {
      text:
        error instanceof DuffelTimeout
          ? "The flight search is taking too long to answer. Please try again in a moment."
          : rateLimited
            ? "Usage limit reached. Please wait a few minutes and try again."
            : "Error searching flights. Please try again.",
      isError: true,
    });
    send("done", { needsInput: false });
  }
}
