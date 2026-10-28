import { requireUser } from "@/app/lib/server/auth";
import { handle } from "@/app/lib/server/http";
import prisma from "@/app/lib/server/prisma";

export const GET = handle(async (request: Request) => {
  const login = requireUser(request);
  if (login instanceof Response) return login;

  const user = await prisma.user.findUnique({ where: { id: login.userId }, include: { currency: true } });
  if (!user) return Response.json({ status: "error", message: "Invalid Token" }, { status: 401 });

  return Response.json({
    valid: true,
    message: "Session is valid",
    user: {
      id: user.id.toString(),
      name: user.name,
      email: user.email,
      currency: user.currency ? { code: user.currency.code } : null,
    },
  });
});
