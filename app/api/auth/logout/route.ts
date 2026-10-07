import { clearedSessionCookie } from "@/app/lib/server/auth";
import { handle } from "@/app/lib/server/http";

/**
 * POST /api/auth/logout — removes the session cookie, which scripts on the page
 * cannot do themselves. Answers the same whether or not anyone was signed in.
 */
export const POST = handle(async () => {
  return Response.json(
    { success: true, message: "Logged out" },
    { headers: { "Set-Cookie": clearedSessionCookie() } },
  );
});
