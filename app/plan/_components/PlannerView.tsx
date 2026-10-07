"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAccount } from "@/app/components/account/AccountProvider";
import { BedIcon, ChatIcon, PlaneIcon } from "@/app/components/ui/Icons";
import { SearchRejected, searchFlights, toSearchResult, type FlightSearchResult } from "@/app/lib/flight-search";
import { formatDate, formatNights, formatPrice } from "@/app/lib/format";
import { MAX_PROMPT_LENGTH } from "@/app/lib/limits";
import { isRoadTripPrompt, plannerHref } from "@/app/lib/routes";
import type { ChatMessage, FlightOffer, Hotel } from "@/app/lib/types";
import type { SearchContext, SearchQuestion, StreamComplete, StreamHotels } from "@/app/lib/types/stream-events";
import ChatPanel from "./chat/ChatPanel";
import { useChatHistory } from "./chat/useChatHistory";
import FlightResults, { FLIGHTS_PAGE_SIZE, type FlightSearchStatus, type FlightSort } from "./flights/FlightResults";
import HotelResults, { staySummary, type HotelSearchStatus, type HotelSort } from "./hotels/HotelResults";
import MobileTabs from "./MobileTabs";

// The backend gives up on Groq after 10s and on Duffel after 20s, and says why.
// This is the fallback for when not even that arrives.
const SEARCH_TIMEOUT_MS = 40_000;

const WELCOME_ID = "welcome";
const WELCOME =
  "Hi, I'm Tourrific AI ✦ Tell me where and when you want to travel, and I'll find flights.";
const TIMEOUT_MESSAGE =
  "The server is taking too long to respond (possibly due to AI limits). Please try again in a moment.";
const CONNECTION_MESSAGE =
  "I'm having trouble connecting to the flight server. Please wait a moment and try again.";
const INVALID_MESSAGE = `I couldn't read that message. Please keep it under ${MAX_PROMPT_LENGTH} characters and try again.`;
const GUEST_LIMIT_NOTE = "You've used your free searches for today. Sign in to keep going.";
const OFFLINE_MESSAGE = "You're offline. Check your connection and try again.";

// Each of these is something the backend understands as a search or a follow-up.
const STARTER_SUGGESTIONS = [
  "Copenhagen to London next Friday",
  "Somewhere with beaches next weekend",
  "Paris tomorrow",
];
const FOLLOW_UP_SUGGESTIONS = ["A little later", "Direct flights only", "With a checked bag", "Somewhere else"];
// Answers to "When would you like to travel?", asked after picking a destination
// card or when a message named a place but no date.
const DATE_SUGGESTIONS = ["Tomorrow", "Next Friday", "Next weekend"];
// Answers to "When would you like to come back?", counted from the departure date.
const RETURN_SUGGESTIONS = ["3 days later", "A week later", "Two weeks later"];

type PlannerTab = "chat" | "flights" | "hotels";

type Props = {
  /** The prompt the visitor arrived with from the landing page, if any. */
  initialPrompt: string;
  /** The city of the destination card the visitor clicked, if they came that way. */
  initialDestination: string;
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
  return [route, travelDates(result), travellers(result), ...result.filters].filter(Boolean).join(" · ");
}

function travellers(result: FlightSearchResult) {
  const count = result.query.passengers ?? 1;
  return count === 1 ? "1 adult" : `${count} adults`;
}

/** "13 of them", "none of them": how many of the found flights passed the filters. */
function removedByFilters(result: FlightSearchResult) {
  return result.unfilteredCount - result.offers.length;
}

/** What the assistant says once the results are in. */
function resultsMessage(result: FlightSearchResult) {
  const { offers, origin, destination } = result;
  const route = `from **${origin.city}** to **${destination.city}**`;
  const dates = travelDates(result);

  const filters = result.filters.length > 0 ? ` (${result.filters.join(", ")})` : "";

  if (offers.length === 0) {
    return removedByFilters(result) > 0
      ? `I found ${result.unfilteredCount.toLocaleString("en-US")} flights ${route}${dates ? ` for ${dates}` : ""}, but none match what you asked for${filters}. Want me to relax one of those?`
      : `I couldn't find any flights ${route}${dates ? ` for ${dates}` : ""}${filters}. Want to try different dates?`;
  }

  const cheapest = offers.reduce((best, offer) => (offer.totalPrice < best.totalPrice ? offer : best));
  const count = `**${offers.length.toLocaleString("en-US")} flight${offers.length === 1 ? "" : "s"}**`;

  const party = (result.query.passengers ?? 1) > 1 ? ` for ${travellers(result)}` : "";
  const matching = filters ? `\nFilters: **${result.filters.join(" · ")}**.` : "";

  return `I found ${count} ${route}${dates ? ` for ${dates}` : ""}.${matching}\nPrices start at **${formatPrice(cheapest.totalPrice, cheapest.currency)}**${party} with ${cheapest.airline.name}.`;
}

/** What the assistant says once the hotels are in. Null when there is nothing worth saying. */
function hotelsMessage({ hotels, totalHotels, stay, sample }: StreamHotels, fallbackCity: string) {
  if (hotels.length === 0) return null;
  if (sample) {
    return `I couldn't reach the hotel search, so I've listed **sample hotels** for ${stay.city ?? fallbackCity}. They are examples, not real availability or prices.`;
  }

  const cheapest = hotels.reduce((best, hotel) => (hotel.nightlyPrice < best.nightlyPrice ? hotel : best));
  const count = `**${totalHotels.toLocaleString("en-US")} place${totalHotels === 1 ? "" : "s"} to stay**`;
  const dates = `${formatDate(stay.checkIn)} – ${formatDate(stay.checkOut)}`;
  // A one-way trip doesn't say how long the stay is.
  const guessed = stay.nightsAssumed ? `\nIt's a one-way trip, so I looked at ${formatNights(stay.nights)}.` : "";

  return `I also found ${count} in **${stay.city ?? fallbackCity}** for ${dates}, from **${formatPrice(cheapest.nightlyPrice, cheapest.currency)}** a night.${guessed}`;
}

export default function PlannerView({ initialPrompt, initialDestination }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (initialPrompt) return [{ id: "initial-user", role: "user", text: initialPrompt }];
    // A destination card was clicked: ask for dates straight away, as the old app did.
    if (initialDestination) {
      const text = `Great choice — **${initialDestination}**! When would you like to travel?`;
      return [{ id: "greeting", role: "assistant", text }];
    }
    return [{ id: WELCOME_ID, role: "assistant", text: WELCOME }];
  });
  const [isSearching, setIsSearching] = useState(Boolean(initialPrompt));
  const [statusLines, setStatusLines] = useState<string[]>([]);
  const [result, setResult] = useState<FlightSearchResult | null>(null);
  /** Why the latest search failed, if it did. Cleared when the next one starts. */
  const [searchError, setSearchError] = useState<string | null>(null);
  /** What the assistant is waiting to be told, if its last reply was a question. */
  const [asking, setAsking] = useState<SearchQuestion | null>(null);
  const [visibleFlights, setVisibleFlights] = useState(FLIGHTS_PAGE_SIZE);
  const [flightSort, setFlightSort] = useState<FlightSort>("best");
  const [hotelSort, setHotelSort] = useState<HotelSort>("recommended");
  /** The flight most recently saved from these results; the hotel messages refer to it. */
  const [selectedFlight, setSelectedFlight] = useState<FlightOffer | null>(null);
  const [savingFlightId, setSavingFlightId] = useState<string | null>(null);
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);
  const [tab, setTab] = useState<PlannerTab>("chat");
  const router = useRouter();
  const { user, isSaved, toggleSaved, openAuth } = useAccount();
  const userId = user?.id ?? null;
  // Signed-in users get their earlier messages back, and this visit's messages stored.
  const earlierMessages = useChatHistory(userId, messages, [WELCOME_ID]);

  // What the backend learned so far, sent back with every message so follow-ups
  // like "a little later" build on the previous search.
  // Starting it with the clicked destination means an answer like "next Friday"
  // is searched as a trip there, while "Paris tomorrow" can still change it.
  const context = useRef<SearchContext>(initialDestination ? { destination: initialDestination } : {});
  const activeSearch = useRef<AbortController | null>(null);
  /** A message turned away because the guest's searches ran out; sent again once they log in. */
  const blockedPrompt = useRef<string | null>(null);

  // The hotels that go with `result`. They arrive after the flights, or not at all when the trip has no night to stay.
  const [hotelSearch, setHotelSearch] = useState<StreamHotels | null>(null);
  const stay = hotelSearch?.stay ?? null;
  const hotels = hotelSearch?.hotels ?? [];

  function addMessage(role: ChatMessage["role"], text: string, action?: ChatMessage["action"]) {
    setMessages((prev) => [...prev, { id: newId(), role, text, action }]);
  }

  function showResults(event: StreamComplete) {
    const next = toSearchResult(event);
    context.current = { destination: event.destination, tripQuery: event.extracted };
    setResult(next);
    // The previous search's hotels go; this one's are on their way.
    setHotelSearch(null);
    setSelectedFlight(null);
    setSelectedHotel(null);
    setFlightSort("best");
    setVisibleFlights(FLIGHTS_PAGE_SIZE);
    setHotelSort("recommended");
    addMessage("assistant", resultsMessage(next));
    return next;
  }

  async function runSearch(prompt: string) {
    activeSearch.current?.abort();
    const controller = new AbortController();
    activeSearch.current = controller;
    blockedPrompt.current = null;
    setIsSearching(true);
    setStatusLines([]);
    setSearchError(null);
    setAsking(null);

    let gotResults = false;
    let destinationCity = "";
    let sawDone = false;
    let reported = false;
    // At most one problem is reported per search, however many ways it fails.
    const report = (text: string, action?: ChatMessage["action"]) => {
      if (reported) return;
      reported = true;
      setSearchError(text);
      addMessage("assistant", text, action);
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
            destinationCity = showResults(event).destination.city;
          },
          hotels: (event) => {
            setHotelSearch(event);
            const text = hotelsMessage(event, destinationCity);
            if (text) addMessage("assistant", text);
          },
          done: ({ needsInput, asking: question, context: next }) => {
            clearTimeout(timeout);
            sawDone = true;
            setAsking(needsInput ? (question ?? null) : null);
            if (next?.destination) context.current.destination = next.destination;
            if (next?.tripQuery) context.current.tripQuery = next.tripQuery;
            // A question replaces whatever was being waited for; a failed search leaves it, so the answer can be retried.
            if (needsInput) context.current.awaiting = next?.awaiting ?? null;
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
      if (!(error instanceof SearchRejected)) {
        report(CONNECTION_MESSAGE);
      } else if (error.status === 429 && error.message) {
        // A limit was reached; the backend's message says which, and what to do about it.
        const guestLimit = error.reason === "guest_limit";
        if (guestLimit) {
          blockedPrompt.current = prompt;
          // Straight to the sign-in dialog; the buttons under the message reopen it if it is closed.
          openAuth("signin", GUEST_LIMIT_NOTE, true);
        }
        report(error.message, guestLimit ? "auth" : undefined);
      } else {
        report(error.status === 400 ? INVALID_MESSAGE : CONNECTION_MESSAGE);
      }
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

  // Logging in gives more searches, so the message that was turned away is sent again.
  useEffect(() => {
    const prompt = blockedPrompt.current;
    if (!userId || !prompt) return;
    const start = setTimeout(() => runSearch(prompt), 0);
    return () => clearTimeout(start);
    // Only a new login triggers it; `runSearch` is new on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

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
    // The two are only added up when they are priced in the same currency.
    return flight.currency === hotel.currency
      ? `Your trip is taking shape: **${flight.airline.name}** plus **${hotel.name}** comes to **${formatPrice(flight.totalPrice + stayCost, flight.currency)}** in total.`
      : `Your trip is taking shape: **${flight.airline.name}** (${flightPrice}) plus **${hotel.name}** (${formatPrice(stayCost, hotel.currency)} for ${formatNights(nights)}).`;
  }

  // Select saves the flight to the account (or removes it again). Guests are asked to sign in.
  async function selectFlight(offer: FlightOffer) {
    if (savingFlightId) return;
    setSavingFlightId(offer.id);
    const outcome = await toggleSaved(offer);
    setSavingFlightId(null);

    if (outcome.status === "error") {
      addMessage("assistant", outcome.message);
    } else if (outcome.status === "removed") {
      if (selectedFlight?.id === offer.id) setSelectedFlight(null);
    } else if (outcome.status === "saved") {
      setSelectedFlight(offer);
      const saved = `Saved! **${offer.airline.name}** ${offer.flightNumber} at ${formatPrice(offer.totalPrice, offer.currency)} is in your saved trips.`;
      addMessage(
        "assistant",
        selectedHotel && stay ? `${saved}\n${tripMessage(offer, selectedHotel, stay.nights)}` : `${saved} Now choose where to stay.`,
      );
    }
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
        : `Lovely choice! **${hotel.name}** is ${formatPrice(hotel.nightlyPrice * stay.nights, hotel.currency)} for ${formatNights(stay.nights)}. Want to pick a flight to go with it?`,
    );
  }

  const flightStatus: FlightSearchStatus = isSearching
    ? "searching"
    : searchError
      ? "error"
      : result
        ? "ready"
        : "idle";

  // While a search runs, the hotels are either the previous search's or still to come.
  const hotelStatus: HotelSearchStatus = isSearching
    ? "searching"
    : hotelSearch?.failed
      ? "error"
      : hotelSearch
        ? "ready"
        : result
          ? "no-stay"
          : "idle";

  function changeFlightSort(sort: FlightSort) {
    setFlightSort(sort);
    // A new order starts again from its top results.
    setVisibleFlights(FLIGHTS_PAGE_SIZE);
  }

  // The chips answer the question the assistant just asked; otherwise they suggest a next search.
  const suggestions =
    asking === "departure_date"
      ? DATE_SUGGESTIONS
      : asking === "return_date"
        ? RETURN_SUGGESTIONS
        : result
          ? FOLLOW_UP_SUGGESTIONS
          : initialDestination
            ? DATE_SUGGESTIONS
            : STARTER_SUGGESTIONS;

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
            earlier={earlierMessages}
            isTyping={isSearching}
            statusLines={statusLines}
            suggestions={suggestions}
            onSend={send}
            footnote="AI-assisted travel planning. Prices can change before you book."
          />
        </div>
        <div id="panel-flights" role="tabpanel" aria-labelledby="tab-flights" className={`${panelClass("flights")} bg-white/40`}>
          <FlightResults
            subtitle={result ? searchSummary(result) : isSearching ? "Looking for your flights" : initialDestination ? `To ${initialDestination} · dates to be chosen` : "No search yet"}
            offers={result?.offers ?? []}
            status={flightStatus}
            errorMessage={searchError}
            filteredOut={result ? removedByFilters(result) : 0}
            visibleCount={visibleFlights}
            onShowMore={() => setVisibleFlights((count) => count + FLIGHTS_PAGE_SIZE)}
            sort={flightSort}
            onSortChange={changeFlightSort}
            isSaved={isSaved}
            savingId={savingFlightId}
            onSelect={selectFlight}
          />
        </div>
        <div id="panel-hotels" role="tabpanel" aria-labelledby="tab-hotels" className={`${panelClass("hotels")} bg-white/40`}>
          <HotelResults
            subtitle={
              stay && result
                ? staySummary(stay.city ?? result.destination.city, stay.checkIn, stay.checkOut, stay.nights)
                : isSearching
                  ? "Looking for places to stay"
                  : "Follows your flight search"
            }
            hotels={hotels}
            nights={stay?.nights ?? 1}
            status={hotelStatus}
            total={hotelSearch?.totalHotels}
            sample={hotelSearch?.sample}
            sort={hotelSort}
            onSortChange={setHotelSort}
            selectedId={selectedHotel?.id ?? null}
            onSelect={selectHotel}
          />
        </div>
      </div>
    </div>
  );
}
