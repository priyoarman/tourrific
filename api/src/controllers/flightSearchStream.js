import { extractTripQuery } from "../groq/extractor.js";
import { searchFlights } from "../services/duffel.js";
import { detectFallbackOrigin } from "../utils/originFallback.js";
import {
  resolveDestination,
  resolveDestinationAirportInput,
} from "../utils/destinationResolver.js";
import { initSse, sendSseEvent, endSse } from "../utils/sse.js";
import { compactOffer } from "../utils/compactOffer.js";

function isReturnTrip(extracted) {
  return extracted.trip_type === "return" || Boolean(extracted.return_date);
}

function buildSearchSlices(extracted, destination) {
  const origin = extracted.origin_airport || null;
  const outbound = {
    destination,
    departure_date: extracted.departure_date,
  };
  if (origin) outbound.origin = origin;

  const slices = [outbound];

  if (extracted.return_date) {
    const inbound = {
      origin: destination,
      departure_date: extracted.return_date,
    };
    if (origin) inbound.destination = origin;
    slices.push(inbound);
  }

  return slices;
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function parseDateOnly(value) {
  if (typeof value !== "string") return new Date(value);
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return new Date(value);

  const [, year, month, day] = match.map(Number);
  return new Date(year, month - 1, day);
}

function toDateOnlyString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDaysToDateString(value, days) {
  if (!value) return null;

  const date = parseDateOnly(value);
  if (Number.isNaN(date.getTime())) return value;

  date.setDate(date.getDate() + days);
  return toDateOnlyString(date);
}

function hasUsefulValue(value) {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim() !== "";
  return true;
}

function mentionsDestinationEdit(prompt) {
  return /\b(somewhere else|somewhere other|other than|another place|different place|different destination|elsewhere|more\s+(south|north|east|west)|a little\s+(south|north|east|west)|further\s+(south|north|east|west))\b/i.test(
    prompt,
  );
}

function mentionsDateEdit(prompt) {
  return /\b(later|earlier|sooner|another date|other date|different date|some other date|same place|there)\b/i.test(
    prompt,
  );
}

function hasExplicitDatePhrase(prompt) {
  return /(\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b|\b(?:tomorrow|today|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b)/i.test(
    prompt,
  );
}

function isFollowUpPrompt(prompt, previousTripQuery) {
  if (!previousTripQuery) return false;

  return mentionsDestinationEdit(prompt) || mentionsDateEdit(prompt);
}

function directionFromPrompt(prompt) {
  const match = prompt.match(
    /\b(?:more|further|a little|slightly)?\s*(south|north|east|west)\b/i,
  );

  return match?.[1]?.toLowerCase() || null;
}

function broadDestinationName(tripQuery) {
  return (
    tripQuery.destination_country ||
    (tripQuery.destination_country_code === "EU" ? "Europe" : null) ||
    (tripQuery.destination_continent_code === "EU" ? "Europe" : null) ||
    "the previous area"
  );
}

function mergeFollowUpTripQuery(extracted, previousTripQuery, userPrompt) {
  if (
    !isPlainObject(previousTripQuery) ||
    !isFollowUpPrompt(userPrompt, previousTripQuery)
  ) {
    return extracted;
  }

  const merged = { ...previousTripQuery };

  for (const [key, value] of Object.entries(extracted)) {
    if (hasUsefulValue(value)) {
      merged[key] = value;
    }
  }

  const direction = directionFromPrompt(userPrompt);
  if (direction) {
    merged.destination_airport = null;
    merged.destination_area = `${direction} of ${broadDestinationName(merged)}`;
  }

  if (
    /\b(somewhere else|somewhere other|other than|another place|different place|different destination|elsewhere)\b/i.test(
      userPrompt,
    )
  ) {
    merged.destination_airport = null;
  }

  if (/\ba little later\b/i.test(userPrompt)) {
    merged.departure_date = addDaysToDateString(merged.departure_date, 3);
    if (merged.return_date) {
      merged.return_date = addDaysToDateString(merged.return_date, 3);
    }
  } else if (/\blater\b/i.test(userPrompt) && !hasExplicitDatePhrase(userPrompt)) {
    merged.departure_date = addDaysToDateString(merged.departure_date, 7);
    if (merged.return_date) {
      merged.return_date = addDaysToDateString(merged.return_date, 7);
    }
  } else if (/\ba little (earlier|sooner)\b/i.test(userPrompt)) {
    merged.departure_date = addDaysToDateString(merged.departure_date, -3);
    if (merged.return_date) {
      merged.return_date = addDaysToDateString(merged.return_date, -3);
    }
  } else if (
    /\b(earlier|sooner)\b/i.test(userPrompt) &&
    !hasExplicitDatePhrase(userPrompt)
  ) {
    merged.departure_date = addDaysToDateString(merged.departure_date, -7);
    if (merged.return_date) {
      merged.return_date = addDaysToDateString(merged.return_date, -7);
    }
  }

  if (
    /\b(another date|other date|different date|some other date)\b/i.test(
      userPrompt,
    ) &&
    !extracted.departure_date &&
    !/\b(later|earlier|sooner)\b/i.test(userPrompt)
  ) {
    merged.departure_date = null;
    merged.return_date = null;
  }

  merged.trip_type = merged.return_date
    ? "return"
    : merged.trip_type || "one_way";
  return merged;
}

function buildSearchStatusMessages(extracted, returnTrip) {
  const origin = extracted.origin_airport || "your location";
  const dest = extracted.destination_airport;
  const messages = [
    `Searching ${returnTrip ? "return " : ""}flights from ${origin} to ${dest}...`,
  ];

  if (extracted.direct_only) {
    messages.push("Checking direct routes...");
  }
  if (extracted.baggage_required) {
    messages.push("Filtering for flights with baggage included...");
  }
  if (extracted.preferred_airlines?.length > 0) {
    messages.push(
      `Looking at ${extracted.preferred_airlines.join(", ")} flights...`,
    );
  }
  if (extracted.departure_time) {
    messages.push(`Narrowing to ${extracted.departure_time} departures...`);
  }

  messages.push("Comparing prices across airlines...");
  return messages;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function emitStatusLines(res, messages, pauseMs = 400) {
  for (const text of messages) {
    sendSseEvent(res, "status", { text: text + " " });
    await delay(pauseMs);
  }
}
/**
 * @openapi
 * /api/flights/search:
 *   post:
 *     summary: Search for flights
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               slices:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     origin: { type: string }
 *                     destination: { type: string }
 *                     departure_date: { type: string, format: date }
 *               passengers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     type: { type: string }
 *               cabin_class: { type: string }
 *     responses:
 *       200: { description: "Flights found" }
 *       400: { description: "Invalid request format" }
 */
export const flightSearchStreamController = async (req, res) => {
  initSse(res);

  const userPrompt = req.body?.prompt;
  const context = isPlainObject(req.body?.context) ? req.body.context : {};
  const contextDestination = context.destination ?? null;
  const previousTripQuery = isPlainObject(context.tripQuery)
    ? context.tripQuery
    : null;
  // `limit: "all"` returns every offer in one response, in a compact form, so the
  // client can sort and page locally instead of re-running the search per page.
  const sendAll = req.body?.limit === "all";
  const page = sendAll ? 1 : Math.max(parseInt(req.body?.page) || 1, 1);
  const defaultLimit = 7;

  if (typeof userPrompt !== "string" || userPrompt.trim() === "") {
    sendSseEvent(res, "error", { message: "Missing prompt." });
    endSse(res);
    return;
  }

  try {
    sendSseEvent(res, "status", { text: " Understanding your request..." });
    await delay(300);

    const extractionPrompt = previousTripQuery
      ? `Previous flight search JSON: ${JSON.stringify(previousTripQuery)}\nUser message: ${userPrompt.trim()}\nIf the user message is a revision or follow-up, keep unchanged fields from the previous search and update only what the user changed.`
      : contextDestination
      ? `Context: The user previously mentioned wanting to fly to ${contextDestination}.\nUser message: ${userPrompt.trim()}`
      : userPrompt.trim();

    const result = await extractTripQuery(extractionPrompt);
    if (!result.ok) {
        // Send the error to the frontend
        sendSseEvent(res, "message", { 
            text: "I'm having trouble connecting to my AI travel service. Please try again in a moment.",
            isError: true 
        });
        sendSseEvent(res, "done", { needsInput: false });
        endSse(res);
        return;
    }


    const extracted = mergeFollowUpTripQuery(
      { ...(result.parsed || {}) },
      previousTripQuery,
      userPrompt.trim(),
    );

    if (!extracted.origin_airport) {
      extracted.origin_airport = await detectFallbackOrigin(req);
    }

    if (!extracted.destination_airport) {
      const match = userPrompt.match(/to\s+([a-zA-Z\s]+)/i);
      if (match?.[1]) {
        extracted.destination_airport = match[1].trim().toUpperCase();
      }
    }

    if (!extracted.destination_airport) {
      const resolved = resolveDestination(extracted);
      if (resolved?.destination_airport) {
        extracted.destination_airport = resolved.destination_airport;
        extracted.explanation = resolved.explanation;
      }
    }

    const destinationEdited =
      Boolean(previousTripQuery) && mentionsDestinationEdit(userPrompt.trim());
    let destination =
      extracted.destination_airport || (destinationEdited ? null : contextDestination);
    destination = resolveDestinationAirportInput(destination);

    if (extracted.explanation) {
      sendSseEvent(res, "message", { text: extracted.explanation });
      await delay(300);
    }

    if (!destination) {
      sendSseEvent(res, "message", {
        text: "I'm a travel assistant. Where would you like to fly today?",
      });
      sendSseEvent(res, "done", { needsInput: true });
      endSse(res);
      return;
    }

    if (!extracted.departure_date) {
      sendSseEvent(res, "message", {
        text: `That's great. Could you please tell me when you'd like to travel?`,
      });
      sendSseEvent(res, "done", {
        needsInput: true,
        context: { destination },
      });
      endSse(res);
      return;
    }

    const returnTrip = isReturnTrip(extracted);

    if (returnTrip && !extracted.return_date) {
      sendSseEvent(res, "message", {
        text: `Got it — a return trip to ${destination}. When would you like to come back?`,
      });
      sendSseEvent(res, "done", {
        needsInput: true,
        context: { destination },
      });
      endSse(res);
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const departureDate = parseDateOnly(extracted.departure_date);
    if (departureDate < today) {
      sendSseEvent(res, "message", {
        text: "I cannot search for flights in the past. Please provide a future date.",
      });
      sendSseEvent(res, "done", { needsInput: true });
      endSse(res);
      return;
    }

    if (extracted.return_date) {
      const returnDate = parseDateOnly(extracted.return_date);
      if (returnDate < today) {
        sendSseEvent(res, "message", {
          text: "The return date cannot be in the past. Please provide a future return date.",
        });
        sendSseEvent(res, "done", { needsInput: true });
        endSse(res);
        return;
      }
      if (returnDate < departureDate) {
        sendSseEvent(res, "message", {
          text: "The return date must be on or after your departure date.",
        });
        sendSseEvent(res, "done", { needsInput: true });
        endSse(res);
        return;
      }
    }

    extracted.destination_airport = destination;
    await emitStatusLines(res, buildSearchStatusMessages(extracted, returnTrip));

    const payload = {
      slices: buildSearchSlices(extracted, destination),
      passengers: [{ type: "adult" }],
      cabin_class: "economy",
      filters: {
        direct_only: extracted.direct_only,
        preferred_airlines: extracted.preferred_airlines,
        baggage_required: extracted.baggage_required,
        departure_time: extracted.departure_time,
      },
    };

   const flights = await searchFlights(payload);
    const offers = flights?.data?.offers ?? [];
    const count = offers.length;

    const limit = sendAll ? Math.max(offers.length, 1) : defaultLimit;
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedOffers = sendAll
      ? offers.map(compactOffer)
      : offers.slice(start, end);
    const totalPages = Math.max(Math.ceil(offers.length / limit), 1);

    if (count > 0) {
      sendSseEvent(res, "status", {
        text: `Found ${count} possible flight${count === 1 ? "" : "s"}.`,
      });
      await delay(300);
    } else {
      sendSseEvent(res, "status", { text: "No flights found for those dates." });
      await delay(200);
    }

    sendSseEvent(res, "complete", {
      destination,
      offers: paginatedOffers,
      extracted,
      pagination: {
        page,
        limit,
        totalOffers: offers.length,
        totalPages,
        hasNextPage: end < offers.length,
        hasPreviousPage: page > 1,
      },
    });
    sendSseEvent(res, "done", { needsInput: false });
    endSse(res);
  } catch (error) {
console.error("DEBUG: Caught error in flightSearchStream:", error);

    try {
        // Force the message out. We don't use the helper here 
        // to ensure it writes directly to the response object.
        const errorData = JSON.stringify({ 
            text: error.message.includes("Rate limit") 
                ? "Usage limit reached. Please wait a few minutes and try again."
                : "Error searching flights. Please try again.",
            isError: true 
        });
        
        res.write(`event: message\ndata: ${errorData}\n\n`);
        res.write(`event: done\ndata: {"needsInput":false}\n\n`);
        
        if (res.flush) res.flush();
    } catch (e) {
        console.error("DEBUG: Failed to send error event (connection likely aborted):", e);
    }
    
    endSse(res);
  }
};
