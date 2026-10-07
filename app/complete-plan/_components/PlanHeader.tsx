import Link from "next/link";
import { ArrowLeftIcon } from "@/app/components/ui/Icons";
import Logo from "@/app/components/ui/Logo";

type Props = { summary: string[]; initials: string };

export default function PlanHeader({ summary, initials }: Props) {
  return (
    <header className="grid grid-cols-[auto_1fr] items-center gap-4 lg:grid-cols-[1fr_auto_1fr]">
      <Logo className="text-2xl sm:text-3xl" />

      <p className="order-last col-span-2 flex flex-wrap items-center justify-center gap-x-2.5 rounded-full bg-lavender-soft px-5 py-2 text-sm font-medium text-ink lg:order-none lg:col-span-1">
        {summary.map((part, index) => (
          <span key={part} className="flex items-center gap-2.5">
            {index > 0 && <span aria-hidden>·</span>}
            {part}
          </span>
        ))}
      </p>

      <div className="flex items-center justify-end gap-5">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeftIcon size={15} />
          New trip
        </Link>
        <span className="flex size-10 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">
          {initials}
        </span>
      </div>
    </header>
  );
}
