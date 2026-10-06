import { MAX_PROMPT_LENGTH } from "@/app/lib/limits";

/** Appears beside the attach button once a message is as long as a search accepts. */
export default function PromptLimitNotice({ length }: { length: number }) {
  return (
    // Always in the page, so screen readers announce the text when it appears.
    <p role="status" className="min-w-0">
      {length >= MAX_PROMPT_LENGTH && (
        <span className="inline-block rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700 sm:text-sm">
          Maximum {MAX_PROMPT_LENGTH} characters limit reached
        </span>
      )}
    </p>
  );
}
