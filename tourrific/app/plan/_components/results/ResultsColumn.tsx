import type { ReactNode } from "react";
import ColumnHeader from "./ColumnHeader";

type Props = {
  title: string;
  icon: ReactNode;
  subtitle: string;
  count: number;
  /** Replaces the default "7 results" note, e.g. "7 of 2,083". */
  meta?: string;
  toolbar?: ReactNode;
  /** Shown instead of the list when there is nothing to list. */
  emptyState?: ReactNode;
  /** True while the list is being replaced; it is dimmed and marked busy. */
  busy?: boolean;
  children: ReactNode;
};

/** Shared frame for the flights and hotels columns: sticky header, scrolling list. */
export default function ResultsColumn({ title, icon, subtitle, count, meta, toolbar, emptyState, busy = false, children }: Props) {
  return (
    <section aria-label={title} className="flex h-full min-h-0 flex-col">
      <ColumnHeader title={title} icon={icon} subtitle={subtitle} meta={meta ?? `${count} results`} toolbar={toolbar} />
      {count === 0 && emptyState ? (
        <div className="flex min-h-0 flex-1 items-start justify-center px-8 pt-16 text-center text-[15px] text-ink-muted">
          {emptyState}
        </div>
      ) : (
        <ul
          aria-busy={busy}
          className={`min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pt-1 pb-6 transition-opacity ${busy ? "opacity-60" : ""}`}
        >
          {children}
        </ul>
      )}
    </section>
  );
}
