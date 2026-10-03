"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BedIcon, ChatIcon, PlaneIcon } from "@/app/components/ui/Icons";
import { stayForSearch } from "@/app/lib/destinations";
import { searchFlights, toSearchResult, type FlightSearchResult } from "@/app/lib/flight-search";
import { formatDate, formatNights, formatPrice } from "@/app/lib/format";
import { getHotels } from "@/app/lib/mock-results";
import { isRoadTripPrompt, plannerHref } from "@/app/lib/routes";
import type { ChatMessage, FlightOffer, Hotel } from "@/app/lib/types";
import type { SearchContext, StreamComplete } from "@/app/lib/types/stream-events";
import ChatPanel from "./chat/ChatPanel";
import FlightResults, { FLIGHTS_PAGE_SIZE, type FlightSearchStatus, type FlightSort } from "./flights/FlightResults";
import HotelResults, { type HotelSort } from "./hotels/HotelResults";
import MobileTabs from "./MobileTabs";
import ResultsColumn from "./results/ResultsColumn";

const SEARCH_TIMEOUT_MS = 30_000;

const WELCOME =
  "Hi, I'm Tourrific AI ✦ Tell me where and when you want to travel, and I'll find flights.";
const TIMEOUT_MESSAGE =
  "The server is taking too long to respond (possibly due to AI limits). Please try again in a moment.";
const CONNECTION_MESSAGE =
  "I'm having trouble connecting to the flight server. Please wait a moment and try again.";
const RATE_LIMIT_MESSAGE = "I've hit my daily AI limit. Please try again in 10 minutes.";
const OFFLINE_MESSAGE = "You're offline. Check your connection and try again.";

// Each of these is something the backend understands as a search or a follow-up.
const STARTER_SUGGESTIONS = [
  "Copenhagen to London next Friday",
  "Somewhere with beaches next weekend",
  "Paris tomorrow",
];
const FOLLOW_UP_SUGGESTIONS = ["A little later", "A little earlier", "Somewhere else"];

type PlannerTab = "chat" | "flights" | "hotels";

type Props = {
  /** The prompt the visitor arrived with from the landing page, if any. */
  initialPrompt: string;
};

let messageCount = 0;
const newId = () => `m${++messageCount}-${Date.now()}`;

function travelDates(result: FlightSearchResult) {
  const { departure_date: depart, return_date: back } = result.query;
  if (!depart) return "";
  return back ? `${formatDate(depart)} – ${formatDate(back)}` : formatDate(depart);
}

function searchSummary(result: FlightSearchResult) {
  const route = `${result.origin.city} → ${result.destination.city}`;
  return [route, travelDates(result), "1 adult"].filter(Boolean).join(" · ");
}

/** What the assistant says once the results are in. */
function resultsMessage(result: FlightSearchResult) {
  const { offers, origin, destination } = result;
  const route = `from **${origin.city}** to **${destination.city}**`;
  const dates = travelDates(result);

  if (offers.length === 0) {
    return `I couldn't find any flights ${route}${dates ? ` for ${dates}` : ""}. Want to try different dates?`;
  }

  const cheapest = offers.reduce((best, offer) => (offer.totalPrice < best.totalPrice ? offer : best));
  const count = `**${offers.length.toLocaleString("en-US")} flight${offers.length === 1 ? "" : "s"}**`;

  return `I found ${count} ${route}${dates ? ` for ${dates}` : ""}.\nPrices start at **${formatPrice(cheapest.totalPrice, cheapest.currency)}** with ${cheapest.airline.name}.\nI've also listed sample hotels for ${destination.city}.`;
}

export default function PlannerView({ initialPrompt }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    initialPrompt
      ? [{ id: "initial-user", role: "user", text: initialPrompt }]
      : [{ id: "welcome", role: "assistant", text: WELCOME }],
  );
  const [isSearching, setIsSearching] = useState(Boolean(initialPrompt));
  const [statusLines, setStatusLines] = useState<string[]>([]);
  const [result, setResult] = useState<FlightSearchResult | null>(null);
  /** Why the latest search failed, if it did. Cleared when the next one starts. */
  const [searchError, setSearchError] = useState<string | null>(null);
  const [visibleFlights, setVisibleFlights] = useState(FLIGHTS_PAGE_SIZE);
  const [flightSort, setFlightSort] = useState<FlightSort>("best");
  const [hotelSort, setHotelSort] = useState<HotelSort>("recommended");
  const [selectedFlight, setSelectedFlight] = useState<FlightOffer | null>(null);
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);
  const [tab, setTab] = useState<PlannerTab>("chat");
  const router = useRouter();

  // What the backend learned so far, sent back with every message so follow-ups
  // like "a little later" build on the previous search.
  const context = useRef<SearchContext>({});
  const activeSearch = useRef<AbortController | null>(null);

  // Hotels are still sample data; they follow the destination and dates of the flight search.
  const stay =
    result?.query.departure_date && result.offers.length > 0
      ? stayForSearch(result.destination, result.origin, result.query.departure_date, result.query.return_date)
      : null;
  const hotels = stay ? getHotels(stay) : [];

  function addMessage(role: ChatMessage["role"], text: string) {
    setMessages((prev) => [...prev, { id: newId(), role, text }]);
  }

  function showResults(event: StreamComplete) {
    const next = toSearchResult(event);
    context.current = { destination: event.destination, tripQuery: event.extracted };
    setResult(next);
    setSelectedFlight(null);
    setSelectedHotel(null);
    setFlightSort("best");
    setVisibleFlights(FLIGHTS_PAGE_SIZE);
    setHotelSort("recommended");
    addMessage("assistant", resultsMessage(next));
  }

  async function runSearch(prompt: string) {
    activeSearch.current?.abort();
    const controller = new AbortController();
    activeSearch.current = controller;
    setIsSearching(true);
    setStatusLines([]);
    setSearchError(null);

    let gotResults = false;
    let sawDone = false;
    let reported = false;
    // At most one problem is reported per search, however many ways it fails.
    const report = (text: string) => {
      if (reported) return;
      reported = true;
      setSearchError(text);
      addMessage("assistant", text);
    };
    const timeout = setTimeout(() => {
      report(TIMEOUT_MESSAGE);
      controller.abort();
    }, SEARCH_TIMEOUT_MS);

    try {
      if (!navigator.onLine) {
        report(OFFLINE_MESSAGE);
        return;
      }

      await searchFlights(
        prompt,
        context.current,
        {
          status: ({ text }) => setStatusLines((lines) => [...lines, text.trim()]),
          message: ({ text, isError }) => (isError ? report(text) : addMessage("assistant", text)),
          complete: (event) => {
            clearTimeout(timeout);
            gotResults = true;
            showResults(event);
          },
          done: ({ needsInput, context: next }) => {
            clearTimeout(timeout);
            sawDone = true;
            if (next?.destination) context.current.destination = next.destination;
            if (next?.tripQuery) context.current.tripQuery = next.tripQuery;
            // `needsInput` means the assistant asked a question; just wait for the answer.
            if (!gotResults && !needsInput) report(CONNECTION_MESSAGE);
          },
          error: ({ message }) => report(message),
        },
        controller.signal,
      );

      if (!sawDone && !gotResults) report(CONNECTION_MESSAGE);
    } catch (error) {
      // Aborted means a newer search replaced this one, the page was left, or it timed out.
      if (controller.signal.aborted) return;
      const isRateLimit = error instanceof Error && /rate limit/i.test(error.message);
      report(isRateLimit ? RATE_LIMIT_MESSAGE : CONNECTION_MESSAGE);
    } finally {
      clearTimeout(timeout);
      if (activeSearch.current === controller) {
        activeSearch.current = null;
        setIsSearching(false);
        setStatusLines([]);
      }
    }
  }

  // Search for the prompt the visitor arrived with. The zero-delay timer lets
  // React's development double-mount cancel the first run before it calls the API.
  useEffect(() => {
    if (!initialPrompt) return;
    const start = setTimeout(() => runSearch(initialPrompt), 0);
    return () => clearTimeout(start);
    // Runs once per mount; `key` on this component resets it for a new prompt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => activeSearch.current?.abort(), []);

  function send(text: string) {
    // Road trips are planned on their own page, with a route map instead of flights.
    if (isRoadTripPrompt(text)) {
      router.push(plannerHref(text));
      return;
    }
    addMessage("user", text);
    setTab("chat");
    runSearch(text);
  }

  function tripMessage(flight: FlightOffer, hotel: Hotel, nights: number) {
    const stayCost = hotel.nightlyPrice * nights;
    const flightPrice = formatPrice(flight.totalPrice, flight.currency);
    // Hotel prices are in USD; only add the two up when the flight is as well.
    return flight.currency === "USD"
      ? `Your trip is taking shape: **${flight.airline.name}** plus **${hotel.name}** comes to **${formatPrice(flight.totalPrice + stayCost)}** in total.`
      : `Your trip is taking shape: **${flight.airline.name}** (${flightPrice}) plus **${hotel.name}** (${formatPrice(stayCost)} for ${formatNights(nights)}).`;
  }

  function selectFlight(offer: FlightOffer) {
    if (selectedFlight?.id === offer.id) {
      setSelectedFlight(null);
      return;
    }
    setSelectedFlight(offer);
    addMessage(
      "assistant",
      selectedHotel && stay
        ? tripMessage(offer, selectedHotel, stay.nights)
        : `Nice pick! **${offer.airline.name}** at ${formatPrice(offer.totalPrice, offer.currency)} is in your trip. Now choose where to stay.`,
    );
  }

  function selectHotel(hotel: Hotel) {
    if (!stay) return;
    if (selectedHotel?.id === hotel.id) {
      setSelectedHotel(null);
      return;
    }
    setSelectedHotel(hotel);
    addMessage(
      "assistant",
      selectedFlight
        ? tripMessage(selectedFlight, hotel, stay.nights)
        : `Lovely choice! **${hotel.name}** is ${formatPrice(hotel.nightlyPrice * stay.nights)} for ${formatNights(stay.nights)}. Want to pick a flight to go with it?`,
    );
  }

  const flightStatus: FlightSearchStatus = isSearching
    ? "searching"
    : searchError
      ? "error"
      : result
        ? "ready"
        : "idle";

  function changeFlightSort(sort: FlightSort) {
    setFlightSort(sort);
    // A new order starts again from its top results.
    setVisibleFlights(FLIGHTS_PAGE_SIZE);
  }

  const panelClass = (id: PlannerTab) =>
    `${tab === id ? "flex" : "hidden"} min-h-0 flex-col lg:flex`;

  return (
    <div className="flex h-dvh flex-col">
      <MobileTabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "chat", label: "Chat", icon: <ChatIcon size={16} /> },
          { id: "flights", label: "Flights", icon: <PlaneIcon size={16} />, count: result?.offers.length ?? 0 },
          { id: "hotels", label: "Hotels", icon: <BedIcon size={16} />, count: hotels.length },
        ]}
      />

      <div className="grid min-h-0 flex-1 lg:grid-cols-3 lg:divide-x lg:divide-lavender-soft/70">
        <div id="panel-chat" role="tabpanel" aria-labelledby="tab-chat" className={panelClass("chat")}>
          <ChatPanel
            messages={messages}
            isTyping={isSearching}
            statusLines={statusLines}
            suggestions={result ? FOLLOW_UP_SUGGESTIONS : STARTER_SUGGESTIONS}
            onSend={send}
            footnote="AI-assisted travel planning. Hotels are sample data."
          />
        </div>
        <div id="panel-flights" role="tabpanel" aria-labelledby="tab-flights" className={`${panelClass("flights")} bg-white/40`}>
          <FlightResults
            subtitle={result ? searchSummary(result) : isSearching ? "Looking for your flights" : "No search yet"}
            offers={result?.offers ?? []}
            status={flightStatus}
            errorMessage={searchError}
            visibleCount={visibleFlights}
            onShowMore={() => setVisibleFlights((count) => count + FLIGHTS_PAGE_SIZE)}
            sort={flightSort}
            onSortChange={changeFlightSort}
            selectedId={selectedFlight?.id ?? null}
            onSelect={selectFlight}
          />
        </div>
        <div id="panel-hotels" role="tabpanel" aria-labelledby="tab-hotels" className={`${panelClass("hotels")} bg-white/40`}>
          {stay ? (
            <HotelResults
              trip={stay}
              hotels={hotels}
              sort={hotelSort}
              onSortChange={setHotelSort}
              selectedId={selectedHotel?.id ?? null}
              onSelect={selectHotel}
            />
          ) : (
            <ResultsColumn
              title="Hotels"
              icon={<BedIcon size={18} />}
              subtitle="Sample data"
              count={0}
              emptyState="Hotel ideas appear here once your flight search has results."
            >
              {null}
            </ResultsColumn>
          )}
        </div>
      </div>
    </div>
  );
}
