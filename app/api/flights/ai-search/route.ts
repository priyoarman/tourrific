import type { NextRequest } from "next/server";
import { requireUser } from "@/app/lib/server/auth";
import { searchFlights, type DuffelSearchPayload } from "@/app/lib/server/duffel";
import { isPlainObject } from "@/app/lib/server/follow-up";
import { extractTripQuery } from "@/app/lib/server/groq/extractor";
import { handle, readJson } from "@/app/lib/server/http";
import { detectFallbackOrigin } from "@/app/lib/server/origin-fallback";
import type { TripQuery } from "@/app/lib/types/trip-query";

function buildDuffelSearchPayload(tripQuery: TripQuery): DuffelSearchPayload {
  const origin = tripQuery.origin_airport ?? undefined;
  const destination = tripQuery.destination_airport ?? undefined;
  const slices = [{ origin, destination, departure_date: tripQuery.departure_date }];
  // A return date adds a second slice for the way back.
  if (tripQuery.return_date) {
    slices.push({ origin: destination, destination: origin, departure_date: tripQuery.return_date });
  }
  return { slices, passengers: [{ type: "adult" }], cabin_class: "economy" };
}

/**
 * POST /api/flights/ai-search — test endpoint: the non-streaming predecessor of
 * /api/flights/search-stream. Send `{ prompt }` to extract and search in one
 * go, or `{ slices, ... }` to search directly with `?page=` and `?limit=`.
 * Requires login, because each call spends Groq and Duffel quota.
 */
export const POST = handle(async (request: NextRequest) => {
  const user = requireUser(request);
  if (user instanceof Response) return user;

  const body = await readJson(request);
  const data = isPlainObject(body) ? body : {};

  if (Array.isArray(data.slices) && isPlainObject(data.slices[0])) {
    const payload = data as DuffelSearchPayload;
    const [outbound, inbound] = payload.slices;
    if (!outbound.origin) outbound.origin = detectFallbackOrigin(request.headers);
    if (inbound && !inbound.destination) inbound.destination = outbound.origin;

    const query = request.nextUrl.searchParams;
    const page = Math.max(parseInt(query.get("page") ?? "") || 1, 1);
    const limit = Math.max(parseInt(query.get("limit") ?? "") || 7, 1);

    const offers = (await searchFlights(payload)).data?.offers ?? [];
    const start = (page - 1) * limit;
    const end = start + limit;

    return Response.json({
      success: true,
      pagination: {
        page,
        limit,
        totalOffers: offers.length,
        totalPages: Math.ceil(offers.length / limit),
        hasNextPage: end < offers.length,
        hasPreviousPage: page > 1,
      },
      data: { offers: offers.slice(start, end) },
    });
  }

  const text = data.prompt ?? data.text ?? data.userText;
  if (typeof text !== "string" || text.trim() === "") {
    return Response.json({ success: false, message: "Missing request data." }, { status: 400 });
  }

  const extracted = await extractTripQuery(text.trim());
  if (!extracted.ok) {
    return Response.json(
      {
        success: false,
        message: "Could not extract a complete flight search query.",
        query: extracted.parsed,
        errors: extracted.errors,
      },
      { status: 422 },
    );
  }

  if (!extracted.parsed.origin_airport) {
    extracted.parsed.origin_airport = detectFallbackOrigin(request.headers);
  }

  const duffelPayload = buildDuffelSearchPayload(extracted.parsed);
  const flights = await searchFlights(duffelPayload);

  return Response.json({ success: true, query: extracted.parsed, duffelPayload, data: flights });
});
