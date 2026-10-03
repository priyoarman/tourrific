import type { Airline } from "@/app/lib/types";

export default function AirlineBadge({ airline }: { airline: Airline }) {
  if (airline.logoUrl) {
    return (
      // Airline logos are small remote SVGs from Duffel, which next/image does not optimise.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={airline.logoUrl}
        alt=""
        width={36}
        height={36}
        loading="lazy"
        className="size-9 shrink-0 rounded-full border border-lavender-soft/70 bg-white object-contain p-1"
      />
    );
  }

  return (
    <span
      aria-hidden
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white"
    >
      {airline.code || airline.name.slice(0, 2).toUpperCase()}
    </span>
  );
}
