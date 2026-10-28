import type { ReactNode } from "react";

type Props = {
  icon?: ReactNode;
  title: string;
  badge?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
};

export const cardClass = "rounded-3xl border border-lavender-soft/50 bg-white shadow-[0_10px_30px_-18px_rgba(42,27,61,0.35)]";

export const arrowClass =
  "flex size-8 items-center justify-center rounded-full bg-lavender-soft text-ink transition-colors hover:bg-lavender disabled:bg-lavender-soft/45 disabled:text-ink-subtle";

export default function SectionCard({ icon, title, badge, aside, children }: Props) {
  return (
    <section className={`${cardClass} p-5`}>
      <div className="flex items-center gap-3">
        {icon && (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-lavender-soft text-ink">
            {icon}
          </span>
        )}
        <h2 className="text-xl font-bold text-ink">{title}</h2>
        {badge}
        <div className="ml-auto text-sm text-ink-muted">{aside}</div>
      </div>
      {children}
    </section>
  );
}
