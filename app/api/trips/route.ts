import { optionalUser, requireUser } from "@/app/lib/server/auth";
import { handle, readJsonWithin, tooManyRequests } from "@/app/lib/server/http";
import { rateLimiter } from "@/app/lib/server/rate-limit";
import { pickedTripSchema } from "@/app/lib/server/schemas";
import { tripLimitRules } from "@/app/lib/server/trip-limits";
import { createTrip, listTrips } from "@/app/lib/server/trips";

// A picked trip is a few kilobytes; this leaves room without inviting more.
const MAX_BODY_BYTES = 32 * 1024;

/**
 * POST /api/trips — stores a flight and a hotel picked in the planner and
 * answers with the trip's id, for /itinerary/[id]. Guests may store trips too;
 * a signed-in user owns theirs from the start. Saving it is a separate step.
 */
export const POST = handle(async (request: Request) => {
  const read = await readJsonWithin(request, MAX_BODY_BYTES);
  if (read.tooLarge) {
    return Response.json({ success: false, message: "Request body is too large." }, { status: 400 });
  }

  const validation = pickedTripSchema.safeParse(read.body);
  if (!validation.success) {
    return Response.json({ success: false, errors: validation.error.flatten().fieldErrors }, { status: 400 });
  }

  const user = optionalUser(request);
  const verdict = await rateLimiter.consume(tripLimitRules(user, request.headers));
  if (!verdict.allowed) {
    return tooManyRequests(
      { message: "You've built a lot of trips today. Please try again tomorrow." },
      verdict.retryAfterSeconds,
    );
  }

  const id = await createTrip(validation.data, user?.userId ?? null);
  return Response.json({ success: true, id }, { status: 201 });
});

/** GET /api/trips — the signed-in user's saved trips, the most recently saved first. */
export const GET = handle(async (request: Request) => {
  const user = requireUser(request);
  if (user instanceof Response) return user;

  return Response.json({ success: true, trips: await listTrips(user.userId) });
});
