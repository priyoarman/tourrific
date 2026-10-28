import { requireUser } from "@/app/lib/server/auth";
import { handle, parseId, readJson, serialize } from "@/app/lib/server/http";
import prisma from "@/app/lib/server/prisma";
import { messageSchema } from "@/app/lib/server/schemas";

type Context = RouteContext<"/api/conversations/[id]/messages">;

async function ownConversation(request: Request, ctx: Context) {
  const user = requireUser(request);
  if (user instanceof Response) return user;

  const id = parseId((await ctx.params).id);
  const conversation =
    id === null ? null : await prisma.conversation.findFirst({ where: { id, userId: user.userId } });

  return conversation ?? Response.json({ error: "Conversation not found" }, { status: 404 });
}

export const GET = handle(async (request: Request, ctx: Context) => {
  const conversation = await ownConversation(request, ctx);
  if (conversation instanceof Response) return conversation;

  const messages = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { timestamp: "asc" },
  });

  return Response.json(serialize(messages));
});

export const POST = handle(async (request: Request, ctx: Context) => {
  const conversation = await ownConversation(request, ctx);
  if (conversation instanceof Response) return conversation;

  const validation = messageSchema.safeParse(await readJson(request));
  if (!validation.success) {
    return Response.json({ error: "Invalid message", errors: validation.error.flatten().fieldErrors }, { status: 400 });
  }

  const message = await prisma.message.create({
    data: { conversationId: conversation.id, ...validation.data },
  });

  return Response.json(serialize(message), { status: 201 });
});
