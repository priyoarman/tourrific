import jwt from "jsonwebtoken";

const TOKEN_LIFETIME_SECONDS = 60 * 60;
export const SESSION_COOKIE = "session";

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error("JWT_SECRET is not defined");
  return value;
}

export function signToken(user: { id: bigint; email: string }) {
  return jwt.sign({ userId: user.id.toString(), email: user.email }, secret(), { expiresIn: TOKEN_LIFETIME_SECONDS });
}

export function sessionCookie(token: string) {
  return cookie(token, TOKEN_LIFETIME_SECONDS);
}

export function clearedSessionCookie() {
  return cookie("", 0);
}

function cookie(value: string, maxAgeSeconds: number) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${value}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Lax${secure}`;
}

function readToken(request: Request) {
  for (const pair of request.headers.get("cookie")?.split(";") ?? []) {
    const [name, value] = pair.trim().split("=");
    if (name === SESSION_COOKIE && value) return value;
  }
  return null;
}

const unauthorized = (message: string) => Response.json({ status: "error", message }, { status: 401 });

export function requireUser(request: Request): { userId: bigint } | Response {
  const token = readToken(request);
  if (!token) return unauthorized("Not signed in");
  return verifyToken(token) ?? unauthorized("Invalid Token");
}

function verifyToken(token: string): { userId: bigint } | null {
  try {
    const decoded = jwt.verify(token, secret());
    const id = typeof decoded === "object" ? (decoded.userId ?? decoded.id) : null;
    if (typeof id !== "string" && typeof id !== "number") return null;
    return { userId: BigInt(id) };
  } catch (error) {
    if (error instanceof Error && error.message === "JWT_SECRET is not defined") throw error;
    return null;
  }
}

export function optionalUser(request: Request): { userId: bigint } | null {
  return userFromToken(readToken(request));
}

export function userFromToken(token: string | null | undefined): { userId: bigint } | null {
  if (!token) return null;
  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}
