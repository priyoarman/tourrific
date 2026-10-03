import type { ReactNode } from "react";
import ColumnHeader from "./ColumnHeader";

type Props = {
  title: string;
  icon: ReactNode;
  subtitle: string;
  count: number;
  toolbar: ReactNode;
  children: ReactNode;
};

/** Shared frame for the flights and hotels columns: sticky header, scrolling list. */
export default function ResultsColumn({ title, icon, subtitle, count, toolbar, children }: Props) {
  return (
    <section aria-label={title} className="flex h-full min-h-0 flex-col">
      <ColumnHeader title={title} icon={icon} subtitle={subtitle} meta={`${count} results`} toolbar={toolbar} />
      <ul className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pt-1 pb-6">{children}</ul>
    </section>
  );
}
