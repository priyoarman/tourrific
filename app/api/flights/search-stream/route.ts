import { optionalUser } from "@/app/lib/server/auth";
import { runFlightSearch, type SendEvent } from "@/app/lib/server/flight-search-stream";
import { crossSiteRefused, isCrossSite, readJsonWithin, tooManyRequests } from "@/app/lib/server/http";
import { rateLimiter } from "@/app/lib/server/rate-limit";
import { searchStreamSchema } from "@/app/lib/server/schemas";
import { dailySearchRules, SEARCH_LIMIT_MESSAGES, searchLimitRules } from "@/app/lib/server/search-limits";
import type { SearchLimitReason } from "@/app/lib/types/stream-events";

export const maxDuration = 60;

const MAX_BODY_BYTES = 8 * 1024;

export async function POST(request: Request) {
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

  const answering = Boolean(validation.data.context?.awaiting);
  const rules = searchLimitRules(optionalUser(request), request.headers, { answering });
  const verdict = await rateLimiter.consume(rules);
  if (!verdict.allowed) {
    const reason = verdict.rule as SearchLimitReason;
    return tooManyRequests({ reason, message: SEARCH_LIMIT_MESSAGES[reason] }, verdict.retryAfterSeconds);
  }

  const body = validation.data;
  const encoder = new TextEncoder();
  let open = true;
  const abandoned = new AbortController();
  request.signal.addEventListener("abort", () => abandoned.abort(), { once: true });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let providerFailed = false;
      const send: SendEvent = (event, data) => {
        if (event === "message" && "isError" in data && data.isError) providerFailed = true;
        if (!open) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      await runFlightSearch(body, request.headers, send, abandoned.signal);
      if (providerFailed) await rateLimiter.refund(dailySearchRules(rules));
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
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
