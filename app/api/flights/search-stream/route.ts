import { optionalUser } from "@/app/lib/server/auth";
import { runFlightSearch, type SendEvent } from "@/app/lib/server/flight-search-stream";
import { crossSiteRefused, isCrossSite, readJsonWithin, tooManyRequests } from "@/app/lib/server/http";
import { rateLimiter } from "@/app/lib/server/rate-limit";
import { searchStreamSchema } from "@/app/lib/server/schemas";
import { SEARCH_LIMIT_MESSAGES, searchLimitRules } from "@/app/lib/server/search-limits";
import type { SearchLimitReason } from "@/app/lib/types/stream-events";

// A search waits on Groq and on Duffel for flights and hotels; give it room on hosts that limit request time.
export const maxDuration = 60;

// A valid request is a short message plus the previous search; nothing near this size.
const MAX_BODY_BYTES = 8 * 1024;

/**
 * POST /api/flights/search-stream
 *
 * Answers with server-sent events (`status`, `message`, `complete`, `hotels`,
 * `done`, `error`), written as each step of the search finishes. The event shapes are
 * in app/lib/types/stream-events.ts.
 *
 * Open to visitors who aren't logged in, so the body is checked before any of
 * it reaches Groq or Duffel, and each visitor gets a limited number of
 * searches (app/lib/server/search-limits.ts). A body that fails the check
 * answers 400, and a visitor over a limit 429, both as JSON.
 */
export async function POST(request: Request) {
  // A signed-in visitor's searches count against their own allowance.
  if (isCrossSite(request)) return crossSiteRefused();

  const read = await readJsonWithin(request, MAX_BODY_BYTES);
  if (read.tooLarge) {
    return Response.json({ success: false, message: "Request body is too large." }, { status: 400 });
  }

  const validation = searchStreamSchema.safeParse(read.body);
  if (!validation.success) {
    return Response.json(
      { success: false, message: "Invalid search request.", errors: validation.error.flatten() },
      { status: 400 },
    );
  }

  // After the body check, so a request that would be rejected anyway uses up no allowance.
  const verdict = await rateLimiter.consume(searchLimitRules(optionalUser(request), request.headers));
  if (!verdict.allowed) {
    const reason = verdict.rule as SearchLimitReason;
    // The body is a SearchLimitResponse.
    return tooManyRequests({ reason, message: SEARCH_LIMIT_MESSAGES[reason] }, verdict.retryAfterSeconds);
  }

  const body = validation.data;
  const encoder = new TextEncoder();
  let open = true;
  // Aborted when the visitor leaves or starts a newer search, so this one stops spending quota.
  const abandoned = new AbortController();
  request.signal.addEventListener("abort", () => abandoned.abort(), { once: true });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send: SendEvent = (event, data) => {
        // The visitor may have left, or started a newer search, before this one finished.
        if (!open) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      await runFlightSearch(body, request.headers, send, abandoned.signal);
      if (open) controller.close();
    },
    cancel() {
      open = false;
      abandoned.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      // `no-transform` also stops compression, which would hold events back.
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
