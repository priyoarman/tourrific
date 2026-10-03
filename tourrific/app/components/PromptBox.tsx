"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PaperclipIcon } from "./ui/Icons";
import { plannerHref } from "@/app/lib/routes";

const MAX_LENGTH = 500;
const EXAMPLE_PROMPT =
  "Ask Tourrific AI to build the best 7-day beach vacation itinerary in Greece";

export default function PromptBox() {
  const [prompt, setPrompt] = useState("");
  const router = useRouter();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        // An empty box plans the example trip shown as the placeholder.
        const q = prompt.trim() || EXAMPLE_PROMPT;
        router.push(plannerHref(q));
      }}
      className="rounded-[32px] border border-lavender-soft bg-white px-6 pt-7 pb-6 shadow-[0_20px_50px_-12px_rgba(167,139,243,0.35)] sm:px-10"
    >
      <label htmlFor="trip-prompt" className="sr-only">
        Describe your trip
      </label>
      <textarea
        id="trip-prompt"
        rows={2}
        maxLength={MAX_LENGTH}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }
        }}
        placeholder={EXAMPLE_PROMPT}
        className="h-21 w-full resize-none bg-transparent text-lg sm:h-14 text-ink placeholder:text-ink-muted focus:outline-none sm:text-xl"
      />

      <div className="mt-4 flex items-center justify-between gap-4">
        <button
          type="button"
          aria-label="Attach a file"
          className="rounded-full p-2 text-ink transition-colors hover:bg-lavender-soft/50"
        >
          <PaperclipIcon size={22} />
        </button>

        <div className="flex items-center gap-6 sm:gap-8">
          <span
            aria-live="polite"
            aria-label={`${prompt.length} of ${MAX_LENGTH} characters`}
            className="text-2xl text-ink tabular-nums"
          >
            {prompt.length}
          </span>
          <button
            type="submit"
            className="flex items-center gap-3 rounded-full bg-lavender px-6 py-4 text-lg font-semibold text-ink transition-colors hover:bg-lavender-hover sm:px-10 sm:text-xl"
          >
            Start planning
            <span aria-hidden>➤</span>
          </button>
        </div>
      </div>
    </form>
  );
}
