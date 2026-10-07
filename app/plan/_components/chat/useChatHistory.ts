import { useEffect, useRef, useState } from "react";
import { getCurrentConversation, getMessages, saveMessage } from "@/app/lib/conversations";
import type { ChatMessage } from "@/app/lib/types";

/** How many earlier messages are shown; the conversation itself is never trimmed. */
const HISTORY_LIMIT = 40;

type Loaded = { userId: string; conversationId: string; earlier: ChatMessage[] };

/**
 * For a signed-in user: loads the messages of earlier visits, and stores each
 * new message of this visit. Does nothing for guests, whose `userId` is null.
 *
 * `messages` is the current conversation. Messages listed in `skipIds` (the
 * welcome line) are never stored.
 */
export function useChatHistory(userId: string | null, messages: ChatMessage[], skipIds: string[] = []) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const stored = useRef(new Set(skipIds));
  /** Saves run one after another, so messages are stored in the order they were said. */
  const queue = useRef(Promise.resolve());

  // History belongs to one login; what was loaded for another is ignored.
  const current = loaded && loaded.userId === userId ? loaded : null;
  const conversationId = current?.conversationId ?? null;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    // The zero-delay timer lets React's development double-mount cancel the first run.
    const start = setTimeout(async () => {
      try {
        const id = await getCurrentConversation();
        const earlier = await getMessages(id);
        if (!cancelled) setLoaded({ userId, conversationId: id, earlier: earlier.slice(-HISTORY_LIMIT) });
      } catch {
        // Without history the chat still works; it just isn't stored this time.
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(start);
    };
  }, [userId]);

  // Storing starts only once the earlier messages are loaded, so this visit's
  // messages can't come back as "earlier" ones.
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
