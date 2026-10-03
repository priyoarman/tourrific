import { requireUser } from "@/app/lib/server/auth";
import { searchFlights } from "@/app/lib/server/duffel";
import { handle, readJson } from "@/app/lib/server/http";
import { searchFlightsSchema } from "@/app/lib/server/schemas";

/**
 * POST /api/flights/search — test endpoint: sends a ready-made search straight
 * to Duffel. The app itself uses /api/flights/search-stream. Requires login,
 * because each call spends Duffel quota.
 */
export const POST = handle(async (request: Request) => {
  const user = requireUser(request);
  if (user instanceof Response) return user;

  const validation = searchFlightsSchema.safeParse(await readJson(request));
  if (!validation.success) {
    return Response.json({ success: false, errors: validation.error.flatten() }, { status: 400 });
  }

  return Response.json({ success: true, data: await searchFlights(validation.data) });
});
