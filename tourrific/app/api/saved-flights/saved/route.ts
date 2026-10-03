import { requireUser } from "@/app/lib/server/auth";
import { handle, serialize } from "@/app/lib/server/http";
import prisma from "@/app/lib/server/prisma";

/** GET /api/saved-flights/saved — the signed-in user's saved flights, soonest departure first. */
export const GET = handle(async (request: Request) => {
  const user = requireUser(request);
  if (user instanceof Response) return user;

  const flights = await prisma.savedOffer.findMany({
    where: { userId: user.userId },
    include: { currency: true },
    orderBy: { departureTime: "asc" },
  });

  return Response.json({ success: true, flights: serialize(flights) });
});
