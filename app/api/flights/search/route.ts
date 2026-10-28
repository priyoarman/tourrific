import { requireUser } from "@/app/lib/server/auth";
import { searchFlights } from "@/app/lib/server/duffel";
import { handle, readJson } from "@/app/lib/server/http";
import { searchFlightsSchema } from "@/app/lib/server/schemas";

export const POST = handle(async (request: Request) => {
  const user = requireUser(request);
  if (user instanceof Response) return user;

  const validation = searchFlightsSchema.safeParse(await readJson(request));
  if (!validation.success) {
    return Response.json({ success: false, errors: validation.error.flatten() }, { status: 400 });
  }

  return Response.json({ success: true, data: await searchFlights(validation.data) });
});
