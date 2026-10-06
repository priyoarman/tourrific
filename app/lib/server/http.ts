// Small helpers shared by the API route handlers.

/** Turns BigInt ids into strings (and Decimals into their string form) so the value can be sent as JSON. */
export function serialize<T>(data: T): unknown {
  return JSON.parse(JSON.stringify(data, (_key, value) => (typeof value === "bigint" ? value.toString() : value)));
}

/** The request's JSON body, or null when it is missing or not valid JSON. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/**
 * The request's JSON body, read only up to `maxBytes`. A bigger body is not
 * read to the end; it answers `tooLarge` instead.
 */
export async function readJsonWithin(
  request: Request,
  maxBytes: number,
): Promise<{ tooLarge: true } | { tooLarge: false; body: unknown }> {
  if (Number(request.headers.get("content-length")) > maxBytes) return { tooLarge: true };

  const reader = request.body?.getReader();
  if (!reader) return { tooLarge: false, body: null };

  // Content-Length can be missing or wrong, so the bytes are counted as they arrive.
  const decoder = new TextDecoder();
  let text = "";
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return { tooLarge: true };
      }
      text += decoder.decode(value, { stream: true });
    }
    return { tooLarge: false, body: JSON.parse(text + decoder.decode()) };
  } catch {
    return { tooLarge: false, body: null };
  }
}

/** A database id from the URL, or null when it isn't a whole number. */
export function parseId(value: string) {
  return /^\d{1,18}$/.test(value) ? BigInt(value) : null;
}

type Handler<Args extends unknown[]> = (...args: Args) => Promise<Response>;

/**
 * Wraps a route handler so an unexpected error becomes a JSON 500 answer, as
 * the Express error handler did. Details are only included outside production.
 */
export function handle<Args extends unknown[]>(handler: Handler<Args>): Handler<Args> {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      console.error("API ERROR:", error);
      const details =
        process.env.NODE_ENV !== "production" && error instanceof Error ? { details: error.message } : {};
      return Response.json({ error: { message: "Internal server error", ...details } }, { status: 500 });
    }
  };
}
