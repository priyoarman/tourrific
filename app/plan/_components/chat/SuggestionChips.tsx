type Props = {
  suggestions: string[];
  onPick: (suggestion: string) => void;
  disabled?: boolean;
};

export default function SuggestionChips({ suggestions, onPick, disabled }: Props) {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Suggestions">
      {suggestions.map((suggestion) => (
        <li key={suggestion}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onPick(suggestion)}
            className="rounded-full border border-lavender-soft bg-white px-4 py-2 text-[0.9375rem] text-ink transition-colors hover:border-lavender hover:bg-lavender-soft/40 disabled:opacity-50"
          >
            {suggestion}
          </button>
        </li>
      ))}
    </ul>
  );
}
