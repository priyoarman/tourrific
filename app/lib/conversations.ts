import { api } from "./api";
import type { ChatMessage } from "./types";

type MessageRow = { id: string; senderRole: "user" | "assistant"; textContent: string };

/** The signed-in user's conversation; the backend creates one on first use. */
export async function getCurrentConversation(token: string) {
  const { id } = await api<{ id: string }>("/api/conversations/current", { token });
  return id;
}

export async function getMessages(token: string, conversationId: string): Promise<ChatMessage[]> {
  const rows = await api<MessageRow[]>(`/api/conversations/${conversationId}/messages`, { token });
  return rows.map((row) => ({
    id: `saved-${row.id}`,
    role: row.senderRole === "user" ? "user" : "assistant",
    text: row.textContent,
  }));
}

export async function saveMessage(token: string, conversationId: string, message: ChatMessage) {
  await api(`/api/conversations/${conversationId}/messages`, {
    method: "POST",
    token,
    body: { senderRole: message.role, textContent: message.text },
  });
}
