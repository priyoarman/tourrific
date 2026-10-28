import { useEffect, useRef, useState } from "react";
import { getCurrentConversation, getMessages, saveMessage } from "@/app/lib/conversations";
import type { ChatMessage } from "@/app/lib/types";

const HISTORY_LIMIT = 40;

type Loaded = { userId: string; conversationId: string; earlier: ChatMessage[] };

export function useChatHistory(userId: string | null, messages: ChatMessage[], skipIds: string[] = []) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const stored = useRef(new Set(skipIds));
  const queue = useRef(Promise.resolve());

  const current = loaded && loaded.userId === userId ? loaded : null;
  const conversationId = current?.conversationId ?? null;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const start = setTimeout(async () => {
      try {
        const id = await getCurrentConversation();
        const earlier = await getMessages(id);
        if (!cancelled) setLoaded({ userId, conversationId: id, earlier: earlier.slice(-HISTORY_LIMIT) });
      } catch {
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(start);
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || !conversationId) return;
    for (const message of messages) {
      if (stored.current.has(message.id)) continue;
      stored.current.add(message.id);
      queue.current = queue.current
        .then(() => saveMessage(conversationId, message))
        .catch(() => {});
    }
  }, [userId, conversationId, messages]);

  return current?.earlier ?? [];
}
