import { requireUser } from "@/app/lib/server/auth";
import { handle } from "@/app/lib/server/http";

/** GET /api/auth/verify — tells whether the token sent with the request is still good. */
export const GET = handle(async (request: Request) => {
  const user = requireUser(request);
  if (user instanceof Response) return user;

  return Response.json({ valid: true, message: "Session is valid" });
});
