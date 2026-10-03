import { requireUser } from "@/app/lib/server/auth";
import { extractTripQuery } from "@/app/lib/server/groq/extractor";
import { handle, readJson } from "@/app/lib/server/http";
import { isPlainObject } from "@/app/lib/server/follow-up";
import { detectFallbackOrigin } from "@/app/lib/server/origin-fallback";

/**
 * POST /api/groq/extract — test endpoint: shows the flight search Groq reads
 * out of a message, without searching. Requires login, because each call
 * spends Groq quota.
 */
export const POST = handle(async (request: Request) => {
  const user = requireUser(request);
  if (user instanceof Response) return user;

  const body = await readJson(request);
  const text = isPlainObject(body) ? (body.prompt ?? body.text ?? body.userText) : null;
  if (typeof text !== "string" || text.trim() === "") {
    return Response.json(
      { success: false, message: "Request body must include a non-empty prompt string." },
      { status: 400 },
    );
  }

  const result = await extractTripQuery(text.trim());
  if (result.parsed && !result.parsed.origin_airport) {
    result.parsed.origin_airport = detectFallbackOrigin(request.headers);
  }

  return Response.json(
    { success: result.ok, data: result.parsed, errors: result.errors },
    { status: result.ok ? 200 : 422 },
  );
});
