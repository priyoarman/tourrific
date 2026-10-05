import Image from "next/image";
import Link from "next/link";
import { destinationHref } from "@/app/lib/routes";

// Photos are from Unsplash, stored in public/images/destinations so the cards
// don't break if a photo is later removed from Unsplash.
const destinations = [
  {
    city: "Barcelona",
    deal: "Sun 23 Nov from $43",
    meta: "Spain • 2h 50m avg",
    photo: "/images/destinations/barcelona.jpg",
  },
  {
    city: "London",
    deal: "Thu 31 Dec from $53",
    meta: "United Kingdom • 2h 10m avg",
    photo: "/images/destinations/london.jpg",
  },
  {
    city: "Palma",
    // The name the flight search should use; "Palma" alone is ambiguous.
    searchName: "Palma de Mallorca",
    deal: "Thu 5 Nov from $76",
    meta: "Majorca • 3h 15m avg",
    photo: "/images/destinations/palma.jpg",
  },
  {
    city: "Madrid",
    deal: "Sat 23 Jan from $80",
    meta: "Spain • 3h 30m avg",
    photo: "/images/destinations/madrid.jpg",
  },
  {
    city: "Lisbon",
    deal: "Fri 14 Nov from $68",
    meta: "Portugal • 3h 05m avg",
    photo: "/images/destinations/lisbon.jpg",
  },
  {
    city: "Paris",
    deal: "Wed 3 Dec from $49",
    meta: "France • 1h 55m avg",
    photo: "/images/destinations/paris.jpg",
  },
];

type Destination = { city: string; searchName?: string; deal: string; meta: string; photo: string };

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
        <li key={d.city} className="shrink-0 pr-2.5 sm:pr-3.5">
          <div className="relative isolate flex h-34 w-52 flex-col justify-end overflow-hidden rounded-2xl bg-ink p-4 sm:h-42.5 sm:w-66 sm:p-5 text-white shadow-[0_8px_24px_-12px_rgba(42,27,61,0.45)] [text-shadow:0_1px_6px_rgb(0_0_0/0.45)]">
            {/* Eager: the row is always moving, so a card must not arrive before its photo. */}
            <Image
              src={d.photo}
              alt=""
              fill
              sizes="264px"
              loading="eager"
              className="-z-20 object-cover"
            />
            {/* Darkens the lower part so the white text stays readable on any photo. */}
            <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-b from-black/10 from-20% to-black/75" />
            <Link
              href={destinationHref(d.searchName ?? d.city)}
              tabIndex={duplicate ? -1 : undefined}
              className="absolute inset-0 rounded-2xl"
            >
              <span className="sr-only">
                Flights to {d.city}, {d.deal}
              </span>
            </Link>
            <h3 className="text-2xl leading-tight sm:text-[2rem] font-bold">{d.city}</h3>
            <p className="mt-0.5 text-[0.8125rem] font-semibold sm:mt-1 sm:text-[0.9375rem]">{d.deal}</p>
            <p className="mt-0.5 text-xs font-medium sm:mt-1 sm:text-[0.8125rem] text-white/85">
              {d.meta}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
