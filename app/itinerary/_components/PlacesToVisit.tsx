"use client";

import { useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@/app/components/ui/Icons";
import type { Place } from "../sample-trip";
import SceneArt from "./SceneArt";
import SectionCard, { arrowClass } from "./SectionCard";

type Props = { places: Place[] };

/** How many cards the design shows at once; the last one peeks in from the edge. */
const VISIBLE = 3;


export default function PlacesToVisit({ places }: Props) {
  const scroller = useRef<HTMLUListElement>(null);
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, places.length - VISIBLE + 1);

  /** The distance from one card to the next, gap included. */
  function step() {
    const cards = scroller.current?.children;
    if (!cards || cards.length < 2) return 0;
    return (cards[1] as HTMLElement).offsetLeft - (cards[0] as HTMLElement).offsetLeft;
  }

  function onScroll() {
    const list = scroller.current;
    const distance = step();
    if (!list || !distance) return;
    // A narrow screen fits fewer cards, so it can scroll further than the dots count.
    const atEnd = list.scrollLeft + list.clientWidth >= list.scrollWidth - 1;
    setPage(atEnd ? pageCount - 1 : Math.min(pageCount - 1, Math.round(list.scrollLeft / distance)));
  }

  function move(direction: 1 | -1) {
    scroller.current?.scrollBy({ left: direction * step(), behavior: "smooth" });
  }

  return (
    <SectionCard
      title="Places to visit"
      aside={
        <div className="flex gap-2.5">
          <button
            type="button"
            aria-label="Previous places"
            disabled={page === 0}
            onClick={() => move(-1)}
            className={arrowClass}
          >
            <ChevronLeftIcon size={15} />
          </button>
          <button
            type="button"
            aria-label="More places"
            disabled={page === pageCount - 1}
            onClick={() => move(1)}
            className={arrowClass}
          >
            <ChevronRightIcon size={15} />
          </button>
        </div>
      }
    >
      <ul
        ref={scroller}
        onScroll={onScroll}
        className="mt-4 flex snap-x gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {places.map((place) => (
          <li key={place.name} className="w-38 shrink-0 snap-start">
            <div className="relative h-32 overflow-hidden rounded-2xl">
              <SceneArt scene={place.scene} />
              <span className="absolute top-2.5 left-2.5 rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-ink">
                {place.tag}
              </span>
            </div>
            <h3 className="mt-3 truncate text-sm font-bold text-ink">{place.name}</h3>
            <p className="mt-0.5 truncate text-xs text-ink-subtle">{place.detail}</p>
          </li>
        ))}
      </ul>

      <div aria-hidden className="mt-4 flex items-center justify-center gap-1.5">
        {Array.from({ length: pageCount }, (_, index) => (
          <span
            key={index}
            className={`h-1.5 rounded-full transition-all ${
              index === page ? "w-5 bg-iris" : "w-1.5 bg-lavender-soft"
            }`}
          />
        ))}
      </div>
    </SectionCard>
  );
}
