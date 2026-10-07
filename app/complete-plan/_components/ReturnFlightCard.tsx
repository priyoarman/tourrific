import { PlaneIcon } from "@/app/components/ui/Icons";
import type { FlightLeg } from "../sample-trip";
import SectionCard from "./SectionCard";

type Props = { price: string; legs: FlightLeg[] };

export default function ReturnFlightCard({ price, legs }: Props) {
  return (
    <SectionCard
      icon={<PlaneIcon size={17} fill="none" stroke="currentColor" strokeWidth="1.8" className="rotate-45" />}
      title="Return flight"
      aside={
        <span className="rounded-full bg-lavender-soft/60 px-3.5 py-1.5 text-xs font-semibold text-ink">
          {price}
        </span>
      }
    >
      <ul className="mt-4 space-y-3">
        {legs.map((leg) => (
          <li key={leg.label} className="rounded-2xl bg-lavender-soft/45 px-4 py-3">
            <div className="flex items-center gap-3 text-sm">
              <span className="rounded-full bg-iris px-3 py-1 text-xs font-semibold text-white">
                {leg.label}
              </span>
              <span className="font-medium text-ink">{leg.date}</span>
              <span className="ml-auto text-xs text-ink-subtle">{leg.route}</span>
            </div>

            <div className="mt-2.5 grid grid-cols-[auto_1fr_auto] items-start gap-5">
              <Endpoint time={leg.departTime} code={leg.departCode} />
              <div className="pt-2.5 text-center">
                <div className="flex items-center gap-3 text-iris">
                  <span className="h-px flex-1 bg-lavender/50" />
                  <PlaneIcon size={15} fill="none" stroke="currentColor" strokeWidth="1.8" className="rotate-90" />
                  <span className="h-px flex-1 bg-lavender/50" />
                </div>
                <p className="mt-1.5 text-xs text-ink-subtle">{leg.duration}</p>
              </div>
              <Endpoint time={leg.arriveTime} code={leg.arriveCode} alignRight />
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function Endpoint({ time, code, alignRight }: { time: string; code: string; alignRight?: boolean }) {
  return (
    <div className={alignRight ? "text-right" : undefined}>
      <p className="text-3xl font-bold tracking-tight text-ink">{time}</p>
      <p className="mt-0.5 text-xs text-ink-subtle">{code}</p>
    </div>
  );
}
