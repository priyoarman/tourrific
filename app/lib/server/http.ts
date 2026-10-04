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
