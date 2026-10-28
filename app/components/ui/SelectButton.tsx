import { CheckIcon, PlusIcon } from "./Icons";

type Props = {
  selected: boolean;
  onClick: () => void;
  label: string;
  selectedText?: string;
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
