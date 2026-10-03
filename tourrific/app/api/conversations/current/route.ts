import { requireUser } from "@/app/lib/server/auth";
import { handle } from "@/app/lib/server/http";
import prisma from "@/app/lib/server/prisma";

/** GET /api/conversations/current — the signed-in user's latest conversation, created on first use. */
export const GET = handle(async (request: Request) => {
  const user = requireUser(request);
  if (user instanceof Response) return user;

  const conversation =
    (await prisma.conversation.findFirst({ where: { userId: user.userId }, orderBy: { createdAt: "desc" } })) ??
    (await prisma.conversation.create({ data: { userId: user.userId } }));

  return Response.json({ id: conversation.id.toString() });
});
