// Login tokens. Ported from api/src/middleware/auth.js and the token part of
// api/src/controllers/auth.js.
import jwt from "jsonwebtoken";

const TOKEN_LIFETIME_SECONDS = 60 * 60;
const SESSION_COOKIE = "session";

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error("JWT_SECRET is not defined");
  return value;
}

export function signToken(user: { id: bigint; email: string }) {
  return jwt.sign({ userId: user.id.toString(), email: user.email }, secret(), { expiresIn: TOKEN_LIFETIME_SECONDS });
}

/**
 * The `Set-Cookie` value that keeps `token` in the browser for as long as it is
 * valid. HttpOnly keeps it out of reach of scripts on the page, and SameSite
 * stops other sites from sending it along with their requests.
 */
export function sessionCookie(token: string) {
  // Local development runs on plain http, where a Secure cookie would be dropped.
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${TOKEN_LIFETIME_SECONDS}; HttpOnly; SameSite=Lax${secure}`;
}

/** The token a request carries: its session cookie, or else an `Authorization: Bearer <token>` header. */
function readToken(request: Request) {
  for (const pair of request.headers.get("cookie")?.split(";") ?? []) {
    const [name, value] = pair.trim().split("=");
    if (name === SESSION_COOKIE && value) return value;
  }

  const header = request.headers.get("authorization");
  return header?.startsWith("Bearer ") ? header.split(" ")[1] : null;
}

const unauthorized = (message: string) => Response.json({ status: "error", message }, { status: 401 });

/**
 * Who is making the request, read from its session cookie or its
 * `Authorization: Bearer <token>` header. Returns a 401 response instead when
 * the token is missing, expired or forged, so a route starts with:
 *
 *   const user = requireUser(request);
 *   if (user instanceof Response) return user;
 */
export function requireUser(request: Request): { userId: bigint } | Response {
  const token = readToken(request);
  if (!token) return unauthorized("Authorization token missing or invalid");

  try {
    const decoded = jwt.verify(token, secret());
    const id = typeof decoded === "object" ? (decoded.userId ?? decoded.id) : null;
    if (typeof id !== "string" && typeof id !== "number") return unauthorized("Invalid Token");
    return { userId: BigInt(id) };
  } catch (error) {
    // A missing secret is a server problem, not the visitor's.
    if (error instanceof Error && error.message === "JWT_SECRET is not defined") throw error;
    return unauthorized("Invalid Token");
  }
}

/**
 * The same, for endpoints that guests may use too: null when nobody is logged
 * in. A token that is expired or forged also counts as a guest, not an error,
 * so a stale login never stops a visitor from using the endpoint.
 */
export function optionalUser(request: Request): { userId: bigint } | null {
  try {
    const user = requireUser(request);
    return user instanceof Response ? null : user;
  } catch {
    // No JWT_SECRET: nobody can hold a valid token, so everyone is a guest.
    return null;
  }
}
