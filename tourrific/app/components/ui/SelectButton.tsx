import { CheckIcon, PlusIcon } from "./Icons";

type Props = {
  selected: boolean;
  onClick: () => void;
  /** Describes what is being selected, for screen readers. */
  label: string;
};

export default function SelectButton({ selected, onClick, label }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`${selected ? "Selected" : "Select"}: ${label}`}
      className={`flex w-full items-center justify-center gap-2 rounded-full border py-2.5 text-[15px] font-semibold transition-colors ${
        selected
          ? "border-lavender bg-lavender text-ink hover:bg-lavender-hover"
          : "border-lavender-soft bg-white text-ink hover:border-lavender hover:bg-lavender-soft/40"
      }`}
    >
      {selected ? <CheckIcon size={16} /> : <PlusIcon size={16} />}
      {selected ? "Selected" : "Select"}
    </button>
  );
}
