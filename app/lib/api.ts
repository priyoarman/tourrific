import { getSession, logOut } from "./auth-store.ts";

export class ApiError extends Error {
  /** HTTP status, or 0 when the request never reached the server. */
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Picks a readable message out of the backend's error shapes. */
export function errorMessage(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const { message, error, errors } = data as Record<string, unknown>;
  if (typeof message === "string" && message) return message;
  if (typeof error === "string" && error) return error;
  if (errors && typeof errors === "object") {
    // Validation errors arrive as { field: ["problem", ...] }.
    for (const [field, problems] of Object.entries(errors)) {
      const first = Array.isArray(problems) ? problems[0] : problems;
      if (typeof first === "string" && first) return `${field}: ${first}`;
    }
  }
  return null;
}

type Options = {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
};

/**
 * Calls a JSON endpoint of the backend and returns its answer, or throws an
 * ApiError. The browser sends the session cookie along by itself; a 401 answer
 * while signed in ends the login.
 */
export async function api<T>(path: string, { method = "GET", body }: Options = {}): Promise<T> {
  const sentAs = getSession();
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }

  const data: unknown = await response.json().catch(() => null);
  if (response.ok) return data as T;

  // The login expired or was rejected: log out, unless a newer login replaced it meanwhile.
  if (response.status === 401 && sentAs && getSession() === sentAs) logOut();

  const fallback =
    response.status >= 500
      ? "The server isn't responding. Please try again in a moment."
      : "Something went wrong. Please try again.";
  throw new ApiError(response.status, errorMessage(data) ?? fallback);
}
