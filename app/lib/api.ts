import { getSession, logOut } from "./auth-store.ts";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function errorMessage(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const { message, error, errors } = data as Record<string, unknown>;
  if (typeof message === "string" && message) return message;
  if (typeof error === "string" && error) return error;
  if (errors && typeof errors === "object") {
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

  if (response.status === 401 && sentAs && getSession() === sentAs) logOut();

  const fallback =
    response.status >= 500
      ? "The server isn't responding. Please try again in a moment."
      : "Something went wrong. Please try again.";
  throw new ApiError(response.status, errorMessage(data) ?? fallback);
}
