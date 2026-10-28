import { clearedSessionCookie } from "@/app/lib/server/auth";
import { handle } from "@/app/lib/server/http";

export const POST = handle(async () => {
  return Response.json(
    { success: true, message: "Logged out" },
    { headers: { "Set-Cookie": clearedSessionCookie() } },
  );
});
