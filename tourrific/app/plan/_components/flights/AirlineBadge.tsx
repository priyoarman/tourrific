import type { Airline } from "@/app/lib/types";

export default function AirlineBadge({ airline }: { airline: Airline }) {
  return (
    <span
      aria-hidden
      className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
      style={{ backgroundColor: airline.color }}
    >
      {airline.code}
    </span>
  );
}
