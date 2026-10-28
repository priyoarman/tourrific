"use client";

import { useEffect, useState } from "react";
import { MailIcon } from "@/app/components/ui/Icons";

const NOTE_MS = 2500;

export default function EmailTripButton() {
  const [noteShown, setNoteShown] = useState(false);

  useEffect(() => {
    if (!noteShown) return;
    const timer = setTimeout(() => setNoteShown(false), NOTE_MS);
    return () => clearTimeout(timer);
  }, [noteShown]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setNoteShown(true)}
        className="flex w-full items-center justify-center gap-2.5 rounded-full bg-lavender-soft py-4 text-sm font-semibold text-ink transition-colors hover:bg-lavender"
      >
        <MailIcon size={16} />
        Send by email
      </button>
      <p role="status" className="pointer-events-none absolute top-full left-1/2 z-10 mt-2 -translate-x-1/2">
        {noteShown && (
          <span className="block rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap text-white shadow-lg">
            Sending by email is coming soon
          </span>
        )}
      </p>
    </div>
  );
}
