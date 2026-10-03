import bcrypt from "bcryptjs";
import { signToken } from "@/app/lib/server/auth";
import { handle, readJson } from "@/app/lib/server/http";
import prisma from "@/app/lib/server/prisma";
import { loginSchema } from "@/app/lib/server/schemas";

// The same answer for an unknown email and a wrong password, so neither can be told apart.
const invalid = () => Response.json({ success: false, message: "Invalid email or password" }, { status: 401 });

/** POST /api/auth/login — checks the password and returns a 1-hour token. */
export const POST = handle(async (request: Request) => {
  const validation = loginSchema.safeParse(await readJson(request));
  if (!validation.success) {
    return Response.json({ success: false, errors: validation.error.flatten().fieldErrors }, { status: 400 });
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
