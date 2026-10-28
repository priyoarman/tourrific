import { optionalUser, requireUser } from "@/app/lib/server/auth";
import { handle } from "@/app/lib/server/http";
import { deleteTrip, getTrip, parseTripId, tripForViewer } from "@/app/lib/server/trips";

const notFound = () => Response.json({ success: false, message: "Trip not found" }, { status: 404 });

/**
 * GET /api/trips/:id — one trip, for anyone who has its link. `owner` says
 * whether it belongs to the visitor ("you"), to someone else, or to nobody yet.
 */
export const GET = handle(async (request: Request, ctx: RouteContext<"/api/trips/[id]">) => {
  const id = parseTripId((await ctx.params).id);
  const trip = id === null ? null : await getTrip(id);
  if (!trip) return notFound();

  const viewer = optionalUser(request);
  return Response.json({ success: true, trip: tripForViewer(trip, viewer?.userId ?? null) });
});

/** DELETE /api/trips/:id — deletes one of the signed-in user's trips. */
export const DELETE = handle(async (request: Request, ctx: RouteContext<"/api/trips/[id]">) => {
  const user = requireUser(request);
  if (user instanceof Response) return user;

  const id = parseTripId((await ctx.params).id);
  // Someone else's trip is reported as not found, the same as one that doesn't exist.
  if (id === null || !(await deleteTrip(id, user.userId))) return notFound();

  return Response.json({ success: true, message: "Trip deleted" });
});
