// Login tokens. Ported from api/src/middleware/auth.js and the token part of
// api/src/controllers/auth.js.
import jwt from "jsonwebtoken";

const TOKEN_LIFETIME = "1h";

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error("JWT_SECRET is not defined");
  return value;
}

export function signToken(user: { id: bigint; email: string }) {
  return jwt.sign({ userId: user.id.toString(), email: user.email }, secret(), { expiresIn: TOKEN_LIFETIME });
}

const unauthorized = (message: string) => Response.json({ status: "error", message }, { status: 401 });

/**
 * Who is making the request, read from its `Authorization: Bearer <token>`
 * header. Returns a 401 response instead when the token is missing, expired or
 * forged, so a route starts with:
 *
 *   const user = requireUser(request);
 *   if (user instanceof Response) return user;
 */
export function requireUser(request: Request): { userId: bigint } | Response {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return unauthorized("Authorization token missing or invalid");

  try {
    const decoded = jwt.verify(header.split(" ")[1], secret());
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
  if (!request.headers.has("authorization")) return null;

  try {
    const user = requireUser(request);
    return user instanceof Response ? null : user;
  } catch {
    // No JWT_SECRET: nobody can hold a valid token, so everyone is a guest.
    return null;
  }
}
