import { requireUser } from "@/app/lib/server/auth";
import { handle, parseId } from "@/app/lib/server/http";
import prisma from "@/app/lib/server/prisma";

export const DELETE = handle(async (request: Request, ctx: RouteContext<"/api/saved-flights/save/[id]">) => {
  const user = requireUser(request);
  if (user instanceof Response) return user;

  const id = parseId((await ctx.params).id);
  const flight = id === null ? null : await prisma.savedOffer.findFirst({ where: { id, userId: user.userId } });
  if (!flight) {
    return Response.json({ success: false, message: "Flight not found" }, { status: 404 });
  }

  await prisma.savedOffer.delete({ where: { id: flight.id } });

  return Response.json({ success: true, message: "Flight removed" });
});
