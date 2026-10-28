import { after } from "next/server";
import { optionalUser, requireUser } from "@/app/lib/server/auth";
import { handle, readJsonWithin, tooManyRequests } from "@/app/lib/server/http";
import { rateLimiter } from "@/app/lib/server/rate-limit";
import { pickedTripSchema } from "@/app/lib/server/schemas";
import { tripLimitRules } from "@/app/lib/server/trip-limits";
import { createTrip, deleteStaleTripsNowAndThen, listTrips } from "@/app/lib/server/trips";

const MAX_BODY_BYTES = 32 * 1024;

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
  after(() => deleteStaleTripsNowAndThen());
  return Response.json({ success: true, id }, { status: 201 });
});

export const GET = handle(async (request: Request) => {
  const user = requireUser(request);
  if (user instanceof Response) return user;

  return Response.json({ success: true, trips: await listTrips(user.userId) });
});
