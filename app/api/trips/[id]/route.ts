import { optionalUser, requireUser } from "@/app/lib/server/auth";
import { handle } from "@/app/lib/server/http";
import { deleteTrip, getTrip, parseTripId, tripForViewer } from "@/app/lib/server/trips";

const notFound = () => Response.json({ success: false, message: "Trip not found" }, { status: 404 });

export const GET = handle(async (request: Request, ctx: RouteContext<"/api/trips/[id]">) => {
  const id = parseTripId((await ctx.params).id);
  const trip = id === null ? null : await getTrip(id);
  if (!trip) return notFound();

  const viewer = optionalUser(request);
  return Response.json({ success: true, trip: tripForViewer(trip, viewer?.userId ?? null) });
});

export const DELETE = handle(async (request: Request, ctx: RouteContext<"/api/trips/[id]">) => {
  const user = requireUser(request);
  if (user instanceof Response) return user;

  const id = parseTripId((await ctx.params).id);
  if (id === null || !(await deleteTrip(id, user.userId))) return notFound();

  return Response.json({ success: true, message: "Trip deleted" });
});
