"use client";

import { useEffect, useRef, type ReactNode } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Names the dialog for screen readers. */
  label: string;
  /** Size and position of the panel; the default centres it. */
  className?: string;
  children: ReactNode;
};

/**
 * A native <dialog>, which traps focus, closes on Escape and dims the page
 * behind it. Clicking the dimmed area closes it too.
 */
export default function Modal({ open, onClose, label, className = "m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl", children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={onClose}
      onClick={(event) => {
        // The panel's content sits in a child, so a click on the dialog itself is on the backdrop.
        if (event.target === event.currentTarget) onClose();
      }}
      className={`bg-transparent p-0 text-ink backdrop:bg-ink/40 backdrop:backdrop-blur-[2px] ${className}`}
    >
      {open && children}
    </dialog>
  );
}
