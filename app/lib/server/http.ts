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

/** A 429 answer: `body` as JSON, with the wait also sent as the Retry-After header. */
export function tooManyRequests(body: Record<string, unknown>, retryAfterSeconds: number) {
  return Response.json(
    { success: false, ...body, retryAfterSeconds },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}

const READ_ONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * True when a browser sent this request from a page on another site. The
 * session cookie travels with every request to us, so without this check
 * another site could act as a visitor who is signed in here.
 *
 * Browsers name the page's site in `Origin` on every request that can change
 * something. A request without one comes from a tool such as curl, which holds
 * no visitor's cookie.
 */
export function isCrossSite(request: Request) {
  if (READ_ONLY_METHODS.has(request.method)) return false;

  const origin = request.headers.get("origin");
  if (origin === null) return false;

  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    // "null", which browsers send from sandboxed pages, or something unreadable.
    return true;
  }
  // Behind a proxy our public name can arrive in either header.
  return host !== request.headers.get("host") && host !== request.headers.get("x-forwarded-host");
}

/** The 403 answer to a request that `isCrossSite`. */
export function crossSiteRefused() {
  return Response.json({ success: false, message: "Cross-site requests are not allowed." }, { status: 403 });
}

type Handler<Args extends unknown[]> = (...args: Args) => Promise<Response>;

/**
 * Wraps a route handler so an unexpected error becomes a JSON 500 answer, as
 * the Express error handler did. Details are only included outside production.
 * A request from another site is refused before the handler runs.
 */
export function handle<Args extends unknown[]>(handler: Handler<Args>): Handler<Args> {
  return async (...args) => {
    const [request] = args;
    if (request instanceof Request && isCrossSite(request)) return crossSiteRefused();

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
