"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import AccountControls from "@/app/components/account/AccountControls";
import { ArrowLeftIcon } from "@/app/components/ui/Icons";
import Logo from "@/app/components/ui/Logo";
import type { ChatMessage as Message } from "@/app/lib/types";
import ChatInput from "./ChatInput";
import ChatMessage from "./ChatMessage";
import SuggestionChips from "./SuggestionChips";
import TypingIndicator from "./TypingIndicator";

type Props = {
  messages: Message[];
  /** Messages from earlier visits, shown above the current conversation. */
  earlier?: Message[];
  isTyping: boolean;
  suggestions: string[];
  onSend: (text: string) => void;
  /** Progress lines shown under the typing dots, e.g. "Comparing prices across airlines...". */
  statusLines?: string[];
  footnote?: string;
};

export default function ChatPanel({
  messages,
  earlier = [],
  isTyping,
  suggestions,
  onSend,
  statusLines = [],
  footnote = "AI-assisted travel planning. Prices and availability are examples.",
}: Props) {
  const logRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view.
  useEffect(() => {
    const log = logRef.current;
    log?.scrollTo({ top: log.scrollHeight, behavior: "smooth" });
  }, [messages, earlier.length, isTyping, statusLines.length]);

  return (
    <section aria-label="Chat" className="flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between px-6 pt-5 pb-3">
        <Logo className="text-2xl" />
        <div className="flex items-center">
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-white hover:text-ink"
          >
            <ArrowLeftIcon size={16} />
            New trip
          </Link>
          <AccountControls />
        </div>
      </header>

      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-label="Conversation"
        className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 pt-4 pb-6"
      >
        {earlier.length > 0 && (
          <>
            {earlier.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            <p
              role="separator"
              className="flex items-center gap-3 text-xs font-medium text-ink-subtle before:h-px before:flex-1 before:bg-lavender-soft after:h-px after:flex-1 after:bg-lavender-soft"
            >
              Earlier messages above
            </p>
          </>
        )}
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
        {isTyping && (
          <div>
            <TypingIndicator />
            {statusLines.map((line, i) => (
              <p key={i} className="text-[0.9375rem] text-ink-muted italic">
                {line}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3 px-4 pb-3">
        <SuggestionChips suggestions={suggestions} onPick={onSend} disabled={isTyping} />
        <ChatInput onSend={onSend} disabled={isTyping} />
        <p className="text-center text-xs text-ink-subtle">{footnote}</p>
      </div>
    </section>
  );
}
