import { runFlightSearch, type SendEvent } from "@/app/lib/server/flight-search-stream";
import { readJson } from "@/app/lib/server/http";

// A search waits on Groq and Duffel; give it room on hosts that limit request time.
export const maxDuration = 60;

/**
 * POST /api/flights/search-stream
 *
 * Answers with server-sent events (`status`, `message`, `complete`, `done`,
 * `error`), written as each step of the search finishes. The event shapes are
 * in app/lib/types/stream-events.ts.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
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
