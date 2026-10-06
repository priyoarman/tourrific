import { runFlightSearch, type SendEvent } from "@/app/lib/server/flight-search-stream";
import { readJsonWithin } from "@/app/lib/server/http";
import { searchStreamSchema } from "@/app/lib/server/schemas";

// A search waits on Groq and Duffel; give it room on hosts that limit request time.
export const maxDuration = 60;

// A valid request is a short message plus the previous search; nothing near this size.
const MAX_BODY_BYTES = 8 * 1024;

/**
 * POST /api/flights/search-stream
 *
 * Answers with server-sent events (`status`, `message`, `complete`, `done`,
 * `error`), written as each step of the search finishes. The event shapes are
 * in app/lib/types/stream-events.ts.
 *
 * Open to visitors who aren't logged in, so the body is checked before any of
 * it reaches Groq or Duffel. A body that fails the check answers 400 as JSON.
 */
export async function POST(request: Request) {
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

  const body = validation.data;
  const encoder = new TextEncoder();
  let open = true;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send: SendEvent = (event, data) => {
        // The visitor may have left, or started a newer search, before this one finished.
        if (!open) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      await runFlightSearch(body, request.headers, send);
      if (open) controller.close();
    },
    cancel() {
      open = false;
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
