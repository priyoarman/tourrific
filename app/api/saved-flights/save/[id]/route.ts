import { requireUser } from "@/app/lib/server/auth";
import { handle, parseId } from "@/app/lib/server/http";
import prisma from "@/app/lib/server/prisma";

/** DELETE /api/saved-flights/save/:id — removes one of the signed-in user's saved flights. */
export const DELETE = handle(async (request: Request, ctx: RouteContext<"/api/saved-flights/save/[id]">) => {
  const user = requireUser(request);
  if (user instanceof Response) return user;

  const id = parseId((await ctx.params).id);
  // Someone else's flight is reported as not found, the same as one that doesn't exist.
  const flight = id === null ? null : await prisma.savedOffer.findFirst({ where: { id, userId: user.userId } });
  if (!flight) {
    return Response.json({ success: false, message: "Flight not found" }, { status: 404 });
  }

  await prisma.savedOffer.delete({ where: { id: flight.id } });

  return Response.json({ success: true, message: "Flight removed" });
});
