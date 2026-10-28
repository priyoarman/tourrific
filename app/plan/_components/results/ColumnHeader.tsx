import type { ReactNode } from "react";

type Props = {
  title: string;
  icon: ReactNode;
  subtitle: string;
  meta: string;
  badge?: ReactNode;
  toolbar?: ReactNode;
};

export default function ColumnHeader({ title, icon, subtitle, meta, badge, toolbar }: Props) {
  return (
    <header className="space-y-3 px-5 pt-5 pb-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-ink">
          <span className="flex size-9 items-center justify-center rounded-full bg-lavender-soft text-ink">
            {icon}
          </span>
          {title}
          {badge}
        </h2>
        <span className="text-sm text-ink-subtle">{meta}</span>
      </div>
      <p className="text-[0.9375rem] text-ink-muted">{subtitle}</p>
      {toolbar}
    </header>
  );
}
