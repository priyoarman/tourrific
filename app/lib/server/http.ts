export function serialize<T>(data: T): unknown {
  return JSON.parse(JSON.stringify(data, (_key, value) => (typeof value === "bigint" ? value.toString() : value)));
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function readJsonWithin(
  request: Request,
  maxBytes: number,
): Promise<{ tooLarge: true } | { tooLarge: false; body: unknown }> {
  if (Number(request.headers.get("content-length")) > maxBytes) return { tooLarge: true };

  const reader = request.body?.getReader();
  if (!reader) return { tooLarge: false, body: null };

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

export function parseId(value: string) {
  return /^\d{1,18}$/.test(value) ? BigInt(value) : null;
}

export function tooManyRequests(body: Record<string, unknown>, retryAfterSeconds: number) {
  return Response.json(
    { success: false, ...body, retryAfterSeconds },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}

const READ_ONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function isCrossSite(request: Request) {
  if (READ_ONLY_METHODS.has(request.method)) return false;

  const origin = request.headers.get("origin");
  if (origin === null) return false;

  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    return true;
  }
  return host !== request.headers.get("host") && host !== request.headers.get("x-forwarded-host");
}

export function crossSiteRefused() {
  return Response.json({ success: false, message: "Cross-site requests are not allowed." }, { status: 403 });
}

type Handler<Args extends unknown[]> = (...args: Args) => Promise<Response>;

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
