import { api } from "./api";
import type { ChatMessage } from "./types";

type MessageRow = { id: string; senderRole: "user" | "assistant"; textContent: string };

/** The signed-in user's conversation; the backend creates one on first use. */
export async function getCurrentConversation() {
  const { id } = await api<{ id: string }>("/api/conversations/current");
  return id;
}

export async function getMessages(conversationId: string): Promise<ChatMessage[]> {
  const rows = await api<MessageRow[]>(`/api/conversations/${conversationId}/messages`);
  return rows.map((row) => ({
    id: `saved-${row.id}`,
    role: row.senderRole === "user" ? "user" : "assistant",
    text: row.textContent,
  }));
}

export async function saveMessage(conversationId: string, message: ChatMessage) {
  await api(`/api/conversations/${conversationId}/messages`, {
    method: "POST",
    body: { senderRole: message.role, textContent: message.text },
  });
}
