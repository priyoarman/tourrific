import { MAX_PROMPT_LENGTH } from "@/app/lib/limits";

export default function PromptLimitNotice({ length }: { length: number }) {
  return (
    <p role="status" className="min-w-0">
      {length >= MAX_PROMPT_LENGTH && (
        <span className="inline-block rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700 sm:text-sm">
          Maximum {MAX_PROMPT_LENGTH} characters limit reached
        </span>
      )}
    </p>
  );
}
