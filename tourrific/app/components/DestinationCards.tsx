import Link from "next/link";
import { plannerHref } from "@/app/lib/routes";

const destinations = [
  {
    city: "Barcelona",
    deal: "Sun 23 Nov from $43",
    meta: "Spain • 2h 50m avg",
    gradient: "from-[#8a7d70] via-[#4f4945] to-[#141414]",
  },
  {
    city: "London",
    deal: "Thu 31 Dec from $53",
    meta: "United Kingdom • 2h 10m avg",
    gradient: "from-[#7486a3] via-[#3c4659] to-[#11141c]",
  },
  {
    city: "Palma",
    deal: "Thu 5 Nov from $76",
    meta: "Majorca • 3h 15m avg",
    gradient: "from-[#d7dade] via-[#8d9098] to-[#2b2c30]",
  },
  {
    city: "Madrid",
    deal: "Sat 23 Jan from $80",
    meta: "Spain • 3h 30m avg",
    gradient: "from-[#e5a452] via-[#5a3a3a] to-[#1a1320]",
  },
  {
    city: "Lisbon",
    deal: "Fri 14 Nov from $68",
    meta: "Portugal • 3h 05m avg",
    gradient: "from-[#e8b27a] via-[#8a5a48] to-[#221716]",
  },
  {
    city: "Paris",
    deal: "Wed 3 Dec from $49",
    meta: "France • 1h 55m avg",
    gradient: "from-[#8795b5] via-[#48506a] to-[#15171f]",
  },
];

type Destination = (typeof destinations)[number];

export default function DestinationCards() {
  return (
    <section
      id="destinations"
      aria-label="Trending destinations"
      className="group overflow-hidden rounded-2xl motion-reduce:overflow-x-auto"
    >
      {/* Two copies side by side; the second is decorative and hidden from assistive tech. */}
      <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused] motion-reduce:animate-none">
        <CardList items={destinations} />
        <CardList items={destinations} duplicate />
      </div>
    </section>
  );
}

function CardList({
  items,
  duplicate = false,
}: {
  items: Destination[];
  duplicate?: boolean;
}) {
  return (
    <ul
      aria-hidden={duplicate || undefined}
      className={`flex shrink-0 ${duplicate ? "motion-reduce:hidden" : ""}`}
    >
      {items.map((d) => (
        // Spacing lives on each card (pr) rather than as a flex gap so both
        // copies are exactly the same width and the -50% loop point is exact.
        <li key={d.city} className="shrink-0 pr-3.5">
          <div
            className={`relative flex h-[170px] w-[264px] flex-col justify-end rounded-2xl bg-linear-to-b ${d.gradient} p-5 text-white shadow-[0_8px_24px_-12px_rgba(42,27,61,0.45)]`}
          >
            <Link
              href={plannerHref(`Plan a trip to ${d.city}`)}
              tabIndex={duplicate ? -1 : undefined}
              className="absolute inset-0 rounded-2xl"
            >
              <span className="sr-only">
                Flights to {d.city}, {d.deal}
              </span>
            </Link>
            <h3 className="text-[32px] leading-tight font-bold">{d.city}</h3>
            <p className="mt-1 text-[15px] font-semibold">{d.deal}</p>
            <p className="mt-1 text-[13px] font-medium text-white/85">
              {d.meta}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
