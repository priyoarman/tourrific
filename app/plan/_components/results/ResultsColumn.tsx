import type { ReactNode } from "react";
import ColumnHeader from "./ColumnHeader";

type Props = {
  title: string;
  icon: ReactNode;
  subtitle: string;
  count: number;
  meta?: string;
  badge?: ReactNode;
  toolbar?: ReactNode;
  emptyState?: ReactNode;
  busy?: boolean;
  children: ReactNode;
};

export default function ResultsColumn({ title, icon, subtitle, count, meta, badge, toolbar, emptyState, busy = false, children }: Props) {
  return (
    <section aria-label={title} className="flex h-full min-h-0 flex-col">
      <ColumnHeader title={title} icon={icon} subtitle={subtitle} meta={meta ?? `${count} results`} badge={badge} toolbar={toolbar} />
      {count === 0 && emptyState ? (
        <div className="flex min-h-0 flex-1 items-start justify-center px-8 pt-16 text-center text-[0.9375rem] text-ink-muted">
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
