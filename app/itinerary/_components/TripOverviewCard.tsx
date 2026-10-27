import { sampleTrip } from "../sample-trip";
import SceneArt from "./SceneArt";
import { cardClass } from "./SectionCard";

type Props = { trip: typeof sampleTrip };

export default function TripOverviewCard({ trip }: Props) {
  return (
    <section className={`${cardClass} p-4`}>
      <div className="relative h-48 overflow-hidden rounded-2xl">
        <SceneArt scene="island" />
        <span className="absolute top-3 left-3 rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink">
          {trip.vibe}
        </span>
        <span className="absolute right-3 bottom-3 rounded-full bg-ink/85 px-3 py-1 text-xs font-semibold text-white">
          1 / {trip.photoCount}
        </span>
      </div>

      <div className="px-1.5 pt-4 pb-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-ink">{trip.title}</h1>
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
            {trip.airportCode}
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{trip.description}</p>

        <ul className="mt-4 flex flex-wrap gap-2 text-xs font-medium">
          {trip.chips.map((chip) => (
            <li key={chip} className="rounded-full bg-lavender-soft/60 px-3 py-1.5 text-ink">
              {chip}
            </li>
          ))}
          <li className="rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-800">{trip.status}</li>
        </ul>

        <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-lavender-soft/70 pt-3.5">
          {trip.facts.map((fact) => (
            <div key={fact.label}>
              <dt className="text-[0.65rem] font-semibold tracking-widest text-ink-subtle uppercase">
                {fact.label}
              </dt>
              <dd className="mt-1.5 text-sm font-semibold text-ink">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
