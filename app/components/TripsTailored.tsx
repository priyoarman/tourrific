import Link from "next/link";
import { plannerHref } from "@/app/lib/routes";

const trips = [
  {
    title: "Greek Island Escape",
    meta: "7 days · Beaches · Food",
    gradient: "from-[#7fd3ea] to-[#3a8fd9]",
  },
  {
    title: "Tokyo After Dark",
    meta: "5 days · City · Culture",
    gradient: "from-[#f0a0c8] to-[#8b5cd6]",
  },
  {
    title: "Alpine Road Trip",
    meta: "6 days · Nature · Driving",
    gradient: "from-[#9fe0b6] to-[#3d9a75]",
  },
];

export default function TripsTailored() {
  return (
    <section
      id="trips"
      className="relative mx-auto w-full max-w-312 px-5 pt-10 pb-20 sm:px-10 sm:pt-14 sm:pb-28"
    >
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-ink sm:text-[3.5rem] sm:leading-tight">
          Trips tailored to you
        </h2>
        <p className="mt-2 text-base text-ink sm:mt-3 sm:text-2xl">
          Thousands of trips shaped around what travelers really wanted
        </p>
      </div>

      <ul className="mt-8 grid gap-5 sm:mt-12 sm:gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {trips.map((trip) => (
          <li
            key={trip.title}
            className="group relative overflow-hidden rounded-[1.75rem] bg-white shadow-[0_16px_40px_-16px_rgba(42,27,61,0.3)] transition-transform hover:-translate-y-1"
          >
            <div
              className={`h-44 sm:h-60 bg-linear-to-br ${trip.gradient}`}
              aria-hidden
            />
            <div className="px-6 pt-5 pb-7">
              <h3 className="text-2xl font-semibold text-ink">
                <Link
                  href={plannerHref(`${trip.title}: ${trip.meta}`)}
                  className="after:absolute after:inset-0"
                >
                  {trip.title}
                </Link>
              </h3>
              <p className="mt-1 text-base text-ink-muted">{trip.meta}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
