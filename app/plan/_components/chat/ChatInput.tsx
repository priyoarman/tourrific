"use client";

import { useState } from "react";
import { ArrowUpIcon, MicIcon, PaperclipIcon } from "@/app/components/ui/Icons";

type Props = {
  onSend: (text: string) => void;
  disabled?: boolean;
};

export default function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState("");
  const canSend = text.trim().length > 0 && !disabled;

  function send() {
    if (!canSend) return;
    onSend(text.trim());
    setText("");
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className="rounded-[1.75rem] border border-lavender-soft bg-white px-5 pt-4 pb-3 shadow-[0_16px_40px_-16px_rgba(167,139,243,0.4)]"
    >
      <label htmlFor="chat-input" className="sr-only">
        Message Tourrific AI
      </label>
      <textarea
        id="chat-input"
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // Enter sends; Shift+Enter adds a new line.
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            send();
          }
        }}
        placeholder="Ask anything..."
        className="w-full resize-none bg-transparent text-lg text-ink placeholder:text-ink-subtle focus:outline-none"
      />
      <div className="mt-1 flex items-center justify-between">
        <button
          type="button"
          aria-label="Attach a file"
          onClick={() => alert("Attachments are coming soon.")}
          className="rounded-full p-2 text-ink transition-colors hover:bg-lavender-soft/50"
        >
          <PaperclipIcon size={22} />
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Voice input"
            onClick={() => alert("Voice input is coming soon.")}
            className="rounded-full p-2 text-ink transition-colors hover:bg-lavender-soft/50"
          >
            <MicIcon size={22} />
          </button>
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Send message"
            className="flex size-12 items-center justify-center rounded-full bg-lavender text-ink transition-colors hover:bg-lavender-hover disabled:bg-lavender-soft disabled:text-ink-subtle"
          >
            <ArrowUpIcon size={22} />
          </button>
        </div>
      </div>
    </form>
  );
}
