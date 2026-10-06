import bcrypt from "bcryptjs";
import { signupLimitRules } from "@/app/lib/server/auth-limits";
import { handle, readJson, tooManyRequests } from "@/app/lib/server/http";
import prisma from "@/app/lib/server/prisma";
import { rateLimiter } from "@/app/lib/server/rate-limit";
import { signupSchema } from "@/app/lib/server/schemas";

const emailTaken = () => Response.json({ success: false, message: "Email already exists" }, { status: 409 });

/**
 * POST /api/auth/signup — creates an account. It returns no token; the client
 * signs in next. One address gets a few attempts a day (429 after that).
 */
export const POST = handle(async (request: Request) => {
  const validation = signupSchema.safeParse(await readJson(request));
  if (!validation.success) {
    return Response.json({ success: false, errors: validation.error.flatten().fieldErrors }, { status: 400 });
  }

  const verdict = await rateLimiter.consume(signupLimitRules(request.headers));
  if (!verdict.allowed) {
    return tooManyRequests(
      { message: "Too many sign-ups from this network today. Please try again tomorrow." },
      verdict.retryAfterSeconds,
    );
  }

  const { name, email, password } = validation.data;

  if (await prisma.user.findUnique({ where: { email } })) return emailTaken();

  const passwordHash = await bcrypt.hash(password, 10);
  const dkk = await prisma.currency.findUnique({ where: { code: "DKK" } });

  try {
    const user = await prisma.user.create({
      data: { name, email, passwordHash, currencyId: dkk?.id ?? null },
      include: { currency: true },
    });

    return Response.json(
      {
        success: true,
        message: "User account created successfully",
        user: {
          id: user.id.toString(),
          name: user.name,
          email: user.email,
          currency: user.currency ? { code: user.currency.code } : null,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    // Two sign-ups with one email at the same moment: the database's unique rule catches the second.
    if ((error as { code?: string }).code === "P2002") return emailTaken();
    throw error;
  }
});
