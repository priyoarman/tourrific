import { requireUser } from "@/app/lib/server/auth";
import { handle } from "@/app/lib/server/http";
import { claimTrip, parseTripId } from "@/app/lib/server/trips";

export const POST = handle(async (request: Request, ctx: RouteContext<"/api/trips/[id]/save">) => {
  const user = requireUser(request);
  if (user instanceof Response) return user;

  const id = parseTripId((await ctx.params).id);
  const outcome = id === null ? "not-found" : await claimTrip(id, user.userId);

  if (outcome === "not-found") {
    return Response.json({ success: false, message: "Trip not found" }, { status: 404 });
  }
  if (outcome === "owned-by-other") {
    return Response.json({ success: false, message: "This trip belongs to someone else" }, { status: 409 });
  }
  return Response.json({ success: true, message: "Trip saved" });
});
