import bcrypt from "bcryptjs";
import { signToken } from "@/app/lib/server/auth";
import { loginLimitRules } from "@/app/lib/server/auth-limits";
import { handle, readJson, tooManyRequests } from "@/app/lib/server/http";
import prisma from "@/app/lib/server/prisma";
import { rateLimiter } from "@/app/lib/server/rate-limit";
import { loginSchema } from "@/app/lib/server/schemas";

// The same answer for an unknown email and a wrong password, so neither can be told apart.
const invalid = () => Response.json({ success: false, message: "Invalid email or password" }, { status: 401 });

/**
 * POST /api/auth/login — checks the password and returns a 1-hour token. One
 * address gets a limited number of attempts (429 after that).
 */
export const POST = handle(async (request: Request) => {
  const validation = loginSchema.safeParse(await readJson(request));
  if (!validation.success) {
    return Response.json({ success: false, errors: validation.error.flatten().fieldErrors }, { status: 400 });
  }

  const verdict = await rateLimiter.consume(loginLimitRules(request.headers));
  if (!verdict.allowed) {
    const minutes = Math.ceil(verdict.retryAfterSeconds / 60);
    return tooManyRequests(
      { message: `Too many login attempts. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` },
      verdict.retryAfterSeconds,
    );
  }

  const { email, password } = validation.data;
  const user = await prisma.user.findUnique({ where: { email }, include: { currency: true } });
  if (!user) return invalid();

  if (!(await bcrypt.compare(password, user.passwordHash))) return invalid();

  return Response.json({
    success: true,
    message: "Login successful",
    token: signToken(user),
    user: {
      id: user.id.toString(),
      name: user.name,
      email: user.email,
      currency: user.currency ? { code: user.currency.code } : null,
    },
  });
});
