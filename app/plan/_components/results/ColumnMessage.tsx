import type { ReactNode } from "react";

type Props = {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  /** "error" announces itself to screen readers and uses a warning colour. */
  tone?: "neutral" | "error";
};

/** Centred note for a results column with nothing to list: empty, no results, or an error. */
export default function ColumnMessage({ icon, title, children, tone = "neutral" }: Props) {
  const isError = tone === "error";
  return (
    <div role={isError ? "alert" : undefined} className="flex max-w-xs flex-col items-center gap-3">
      <span
        aria-hidden
        className={`flex size-14 items-center justify-center rounded-full ${
          isError ? "bg-red-50 text-red-700" : "bg-lavender-soft/60 text-ink"
        }`}
      >
        {icon}
      </span>
      <p className="text-lg font-semibold text-ink">{title}</p>
      {children && <p className="text-[15px] text-ink-muted">{children}</p>}
    </div>
  );
}
