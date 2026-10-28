import type { DuffelOffer } from "../types/duffel";
import type { SearchContext, SearchQuestion, StreamEventMap, StreamEventName } from "../types/stream-events";
import type { TripQuery } from "../types/trip-query";
import { compactOffer } from "./compact-offer.ts";
import { resolveDestination, resolveDestinationAirportInput } from "./destination-resolver.ts";
import { DuffelTimeout, searchFlightsCached, type DuffelSearchSlice } from "./duffel.ts";
import { duffelSearchOptions, filterOffers, passengerCount } from "./flight-filters.ts";
import {
  isPlainObject,
  mentionsDestinationEdit,
  mergeFollowUpTripQuery,
  parseDateOnly,
  returnDateFromAnswer,
} from "./follow-up.ts";
import { extractTripQuery, parseStayLength, saysOneWay } from "./groq/extractor.ts";
import { searchHotels, stayNights } from "./hotel-search.ts";
import { detectFallbackOrigin } from "./origin-fallback.ts";
import { searchScope } from "./search-scope.ts";
import { returnDateFor } from "./stay-length.ts";

const PAGE_SIZE = 7;

export type SendEvent = <K extends StreamEventName>(event: K, data: StreamEventMap[K]) => void;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const HOTEL_WAIT_MS = 4_000;

function within<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  const waiting = new AbortController();
  const late = new Promise<undefined>((resolve) => {
    const timer = setTimeout(resolve, ms);
    waiting.signal.addEventListener("abort", () => clearTimeout(timer));
  });
  return Promise.race([promise, late]).finally(() => waiting.abort());
}

const counted = (count: number, thing: string) => `${count} possible ${thing}${count === 1 ? "" : "s"}`;

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

function buildSearchStatusMessages(extracted: TripQuery, returnTrip: boolean, withHotels: boolean) {
  const origin = extracted.origin_airport || "your location";
  const messages = [
    `Searching ${returnTrip ? "return " : ""}flights from ${origin} to ${extracted.destination_airport}...`,
  ];
  if (withHotels) messages.push(`Searching hotels near ${extracted.destination_airport}...`);

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

  messages.push(`Comparing prices across airlines${withHotels ? " and hotels" : ""}...`);
  return messages;
}

export async function runFlightSearch(body: unknown, headers: Headers, send: SendEvent, signal?: AbortSignal) {
  const request = isPlainObject(body) ? body : {};
  const userPrompt = typeof request.prompt === "string" ? request.prompt.trim() : "";
  const context = (isPlainObject(request.context) ? request.context : {}) as SearchContext;
  const contextDestination = typeof context.destination === "string" ? context.destination : null;
  const contextTripQuery = isPlainObject(context.tripQuery) ? (context.tripQuery as TripQuery) : null;
  const awaitingReturn =
    context.awaiting === "return_date" && contextTripQuery?.departure_date ? contextTripQuery : null;
  const previousTripQuery = awaitingReturn ? null : contextTripQuery;
  const awaitingDeparture = context.awaiting === "departure_date" ? contextTripQuery : null;
  const sendAll = request.limit === "all";
  const page = sendAll ? 1 : Math.max(parseInt(String(request.page)) || 1, 1);

  if (!userPrompt) {
    send("error", { message: "Missing prompt." });
    return;
  }

  const hotelsWanted = new AbortController();
  const hotelSignal = signal ? AbortSignal.any([signal, hotelsWanted.signal]) : hotelsWanted.signal;

  const ask = (asking: SearchQuestion, text: string, nextContext?: SearchContext) => {
    send("message", { text });
    send("done", nextContext ? { needsInput: true, asking, context: nextContext } : { needsInput: true, asking });
  };

  const askReturnDate = (text: string, search: TripQuery, destination: string) => {
    const tripQuery: TripQuery = { ...search, destination_airport: destination, return_date: null, trip_type: "return" };
    delete tripQuery.explanation;
    ask("return_date", text, { destination, tripQuery, awaiting: "return_date" });
  };

  const askDepartureDate = (text: string, search: TripQuery, destination: string) => {
    const tripQuery: TripQuery = { ...search, destination_airport: destination, departure_date: null, return_date: null };
    delete tripQuery.explanation;
    ask("departure_date", text, { destination, tripQuery, awaiting: "departure_date" });
  };

  const extractionFailed = (reason: string) => {
    send("message", { text: EXTRACTION_PROBLEMS[reason] ?? EXTRACTION_PROBLEM, isError: true });
    send("done", { needsInput: false });
  };

  try {
    send("status", { text: " Understanding your request..." });
    await delay(300);

    let extracted: TripQuery;

    if (awaitingReturn) {
      const departure = awaitingReturn.departure_date as string;
      const destination = awaitingReturn.destination_airport ?? contextDestination ?? "";
      let returnDate = returnDateFromAnswer(userPrompt, departure);

      if (!returnDate) {
        const question = `A return flight to ${destination} leaves on ${departure}. The traveller was asked when they want to fly back, and answered: "${userPrompt}"\nSet departure_date to ${departure} and return_date to the date they fly back, which is on or after ${departure}. Leave every other field null.`;
        const result = await extractTripQuery(question, { signal, datesFrom: null });
        if (signal?.aborted) return;
        if (!result.ok) return extractionFailed(result.errors[0]);

        const { return_date: back, departure_date: leaving } = result.parsed;
        const read = back ?? (leaving !== departure ? leaving : null);
        returnDate = read && /^\d{4}-\d{2}-\d{2}$/.test(read) ? read : null;
      }

      if (!returnDate) {
        askReturnDate("Sorry, I didn't catch a date. When would you like to come back?", awaitingReturn, destination);
        return;
      }
      extracted = { ...awaitingReturn, return_date: returnDate, trip_type: "return" };
    } else {
      const extractionPrompt = previousTripQuery
        ? `Previous flight search JSON: ${JSON.stringify(previousTripQuery)}\nUser message: ${userPrompt}\nIf the user message is a revision or follow-up, keep unchanged fields from the previous search and update only what the user changed.`
        : contextDestination
          ? `Context: The user previously mentioned wanting to fly to ${contextDestination}.\nUser message: ${userPrompt}`
          : userPrompt;

      const result = await extractTripQuery(extractionPrompt, { signal });
      if (signal?.aborted) return;
      if (!result.ok) return extractionFailed(result.errors[0]);

      extracted = mergeFollowUpTripQuery({ ...result.parsed }, previousTripQuery, userPrompt);
      if (awaitingDeparture?.stay_length && !extracted.stay_length) {
        extracted.stay_length = awaitingDeparture.stay_length;
        extracted.stay_unit = awaitingDeparture.stay_unit;
      }
    }

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
      ask("destination", "I'm a travel assistant. Where would you like to fly today?");
      return;
    }

    if (!extracted.departure_date) {
      askDepartureDate("That's great. Could you please tell me when you'd like to travel?", extracted, destination);
      return;
    }

    if (saysOneWay(userPrompt)) {
      Object.assign(extracted, { trip_type: "one_way", return_date: null, stay_length: null, stay_unit: null });
    } else {
      const statedStay = parseStayLength(userPrompt);
      if (statedStay.stay_length) Object.assign(extracted, statedStay);
    }

    if (extracted.stay_length && extracted.stay_unit) {
      const stayEnds = returnDateFor(extracted.departure_date, extracted.stay_length, extracted.stay_unit);
      const returnSaid = Boolean(extracted.return_date) && extracted.return_date !== previousTripQuery?.return_date;
      if (returnSaid && extracted.return_date !== stayEnds) {
        extracted.stay_length = null;
        extracted.stay_unit = null;
      } else {
        extracted.return_date = stayEnds;
        extracted.trip_type = "return";
      }
    }

    const returnTrip = isReturnTrip(extracted);

    if (returnTrip && !extracted.return_date) {
      askReturnDate(`Got it — a return trip to ${destination}. When would you like to come back?`, extracted, destination);
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const departureDate = parseDateOnly(extracted.departure_date);
    if (departureDate < today) {
      askDepartureDate("I cannot search for flights in the past. Please provide a future date.", extracted, destination);
      return;
    }

    if (extracted.return_date) {
      const returnDate = parseDateOnly(extracted.return_date);
      if (returnDate < today) {
        askReturnDate("The return date cannot be in the past. Please provide a future return date.", extracted, destination);
        return;
      }
      if (returnDate < departureDate) {
        askReturnDate("The return date must be on or after your departure date.", extracted, destination);
        return;
      }
    }

    extracted.destination_airport = destination;
    send("scope", { scope: searchScope(previousTripQuery, extracted) });
    const withHotels = page === 1 && stayNights(extracted) !== null;
    for (const text of buildSearchStatusMessages(extracted, returnTrip, withHotels)) {
      send("status", { text: `${text} ` });
      await delay(400);
    }

    const { outboundDepartureTime, ...searchOptions } = duffelSearchOptions(extracted);
    const slices = buildSearchSlices(extracted, destination);
    if (outboundDepartureTime) slices[0].departure_time = outboundDepartureTime;

    if (signal?.aborted) return;
    const hotelsFound = withHotels ? searchHotels(extracted, destination, hotelSignal) : null;
    const flights = await searchFlightsCached({ slices, ...searchOptions }, signal);
    const found: DuffelOffer[] = flights?.data?.offers ?? [];
    const { offers, labels, unfilteredCount } = filterOffers(found, extracted);
    const count = offers.length;

    const limit = sendAll ? Math.max(count, 1) : PAGE_SIZE;
    const start = (page - 1) * limit;
    const end = start + limit;

    const hotelsInTime = hotelsFound ? await within(hotelsFound, HOTEL_WAIT_MS) : null;
    if (signal?.aborted) return;
    const hotelCount = hotelsInTime && !hotelsInTime.failed ? hotelsInTime.totalHotels : null;
    const hotelsToo = hotelCount === null ? "" : hotelCount > 0 ? ` Found ${counted(hotelCount, "hotel")}.` : " No hotels found.";

    if (count < unfilteredCount) {
      send("status", {
        text: `Found ${unfilteredCount} flight${unfilteredCount === 1 ? "" : "s"}, ${count || "none"} of them match${count === 1 ? "es" : ""} what you asked for.${hotelsToo}`,
      });
      await delay(300);
    } else if (count > 0) {
      send("status", {
        text: hotelCount ? `Found ${counted(count, "flight")} and ${counted(hotelCount, "hotel")}.` : `Found ${counted(count, "flight")}.${hotelsToo}`,
      });
      await delay(300);
    } else {
      send("status", { text: `No flights found for those dates.${hotelsToo}` });
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

    const hotels = await hotelsFound;
    if (signal?.aborted) return;
    if (hotels) send("hotels", hotels);

    send("done", { needsInput: false });
  } catch (error) {
    hotelsWanted.abort();
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
