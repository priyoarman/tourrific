import { BedIcon, ExpandIcon, MapPinIcon, PlaneIcon } from "@/app/components/ui/Icons";
import type { MapStop } from "../sample-trip";
import SectionCard from "./SectionCard";

type Props = { stops: MapStop[] };

const PIN: Record<MapStop["kind"], { color: string; icon: React.ReactNode }> = {
  airport: {
    color: "bg-iris",
    icon: <PlaneIcon size={12} fill="none" stroke="currentColor" strokeWidth="2" className="rotate-45" />,
  },
  hotel: { color: "bg-ink", icon: <BedIcon size={12} /> },
  place: { color: "bg-amber-400", icon: <MapPinIcon size={12} /> },
};

/** A drawn stand-in for the trip map until a real map is wired up. */
export default function MapCard({ stops }: Props) {
  return (
    <SectionCard
      title="Map"
      aside={
        <button
          type="button"
          aria-label="Expand map"
          className="flex size-8 items-center justify-center rounded-full bg-lavender-soft/60 text-ink transition-colors hover:bg-lavender-soft"
        >
          <ExpandIcon size={14} />
        </button>
      }
    >
      <div className="relative mt-3 h-40 overflow-hidden rounded-2xl border border-lavender-soft/70">
        <svg viewBox="0 0 576 212" preserveAspectRatio="xMidYMid slice" aria-hidden className="block size-full">
          <rect width="576" height="212" fill="#f4f1ea" />
          <path d="M420 0c-14 30 4 52 0 84-4 30 22 50 40 72 14 18 30 36 34 56h82V0z" fill="#d6e4f3" />
          <ellipse cx="300" cy="50" rx="46" ry="20" fill="#dde9d6" />
          <ellipse cx="160" cy="146" rx="56" ry="22" fill="#dde9d6" />
          <g fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round">
            <path d="M150 0c8 60 40 150 62 212" />
            <path d="M0 104c90-6 180 8 260 0 60-6 110-12 160-22" />
            <path d="M270 0c10 40 30 70 60 96" />
            <path d="M0 176c110 0 220-14 330-16 40 0 70 14 100 30" />
            <path d="M310 110c4 40 10 70 14 102" />
          </g>
          <path d="M158 67c30 26 56 36 86 46" fill="none" stroke="#6b51d6" strokeWidth="3" strokeDasharray="8 6" />
          <path d="M346 148c10 6 20 10 32 16" fill="none" stroke="#e0a730" strokeWidth="3" strokeDasharray="6 5" />
        </svg>

        {stops.map((stop) => (
          <span
            key={stop.label}
            style={{ left: stop.left, top: stop.top }}
            className="absolute flex -translate-y-1/2 items-center gap-1.5 rounded-full bg-white py-1 pr-3 pl-1 text-xs font-semibold whitespace-nowrap text-ink shadow-[0_4px_12px_-4px_rgba(42,27,61,0.35)]"
          >
            <span className={`flex size-5 items-center justify-center rounded-full text-white ${PIN[stop.kind].color}`}>
              {PIN[stop.kind].icon}
            </span>
            {stop.label}
          </span>
        ))}
      </div>
    </SectionCard>
  );
}
