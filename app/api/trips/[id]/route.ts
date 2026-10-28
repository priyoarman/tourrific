import { optionalUser } from "@/app/lib/server/auth";
import { handle } from "@/app/lib/server/http";
import { getTrip, parseTripId, tripForViewer } from "@/app/lib/server/trips";

/**
 * GET /api/trips/:id — one trip, for anyone who has its link. `owner` says
 * whether it belongs to the visitor ("you"), to someone else, or to nobody yet.
 */
export const GET = handle(async (request: Request, ctx: RouteContext<"/api/trips/[id]">) => {
  const id = parseTripId((await ctx.params).id);
  const trip = id === null ? null : await getTrip(id);
  if (!trip) {
    return Response.json({ success: false, message: "Trip not found" }, { status: 404 });
  }

  const viewer = optionalUser(request);
  return Response.json({ success: true, trip: tripForViewer(trip, viewer?.userId ?? null) });
});
