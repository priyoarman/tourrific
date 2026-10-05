import { CheckIcon, PlusIcon } from "./Icons";

type Props = {
  selected: boolean;
  onClick: () => void;
  /** Describes what is being selected, for screen readers. */
  label: string;
  /** The button's text once selected. */
  selectedText?: string;
  /** True while the choice is being saved; the button is disabled meanwhile. */
  busy?: boolean;
};

export default function SelectButton({ selected, onClick, label, selectedText = "Selected", busy = false }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={selected}
      aria-label={`${selected ? selectedText : "Select"}: ${label}`}
      className={`flex w-full items-center justify-center gap-2 rounded-full border py-2.5 text-[0.9375rem] font-semibold transition-colors disabled:opacity-60 ${
        selected
          ? "border-lavender bg-lavender text-ink hover:bg-lavender-hover"
          : "border-lavender-soft bg-white text-ink hover:border-lavender hover:bg-lavender-soft/40"
      }`}
    >
      {selected ? <CheckIcon size={16} /> : <PlusIcon size={16} />}
      {selected ? selectedText : "Select"}
    </button>
  );
}
