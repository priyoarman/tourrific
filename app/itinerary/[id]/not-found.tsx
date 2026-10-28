import Link from "next/link";
import { ArrowLeftIcon } from "@/app/components/ui/Icons";
import Logo from "@/app/components/ui/Logo";

export default function TripNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-5 py-16 text-center">
      <Logo className="text-2xl sm:text-3xl" />
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink">We couldn&apos;t find this trip</h1>
      <p className="text-[0.9375rem] text-ink-muted">
        The link may be mistyped, or the trip was deleted. Plan a new one and it gets its own itinerary.
      </p>
      <Link
        href="/plan"
        className="mt-2 flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-ink/90"
      >
        <ArrowLeftIcon size={15} />
        Plan a trip
      </Link>
    </div>
  );
}
