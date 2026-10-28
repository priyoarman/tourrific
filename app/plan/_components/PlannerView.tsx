"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAccount } from "@/app/components/account/AccountProvider";
import { BedIcon, ChatIcon, PlaneIcon } from "@/app/components/ui/Icons";
import { SearchRejected, searchFlights, toSearchResult, type FlightSearchResult } from "@/app/lib/flight-search";
import { formatDate, formatNights, formatPrice } from "@/app/lib/format";
import { MAX_PROMPT_LENGTH } from "@/app/lib/limits";
import { isRoadTripPrompt, plannerHref } from "@/app/lib/routes";
import { tripTotal } from "@/app/lib/trip-total";
import { createTrip } from "@/app/lib/trips";
import type { ChatMessage, FlightOffer, Hotel, PickedTrip } from "@/app/lib/types";
import type { SearchContext, SearchQuestion, StreamComplete, StreamHotels } from "@/app/lib/types/stream-events";
import ChatPanel from "./chat/ChatPanel";
import { useChatHistory } from "./chat/useChatHistory";
import FlightResults, { FLIGHTS_PAGE_SIZE, type FlightSearchStatus, type FlightSort } from "./flights/FlightResults";
import HotelResults, {
  oneWayStaySummary,
  staySummary,
  type HotelSearchStatus,
  type HotelSort,
} from "./hotels/HotelResults";
import MobileTabs from "./MobileTabs";
import TripReadyDialog from "./TripReadyDialog";

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

const STARTER_SUGGESTIONS = [
  "Copenhagen to London next Friday",
  "Somewhere with beaches next weekend",
  "Paris tomorrow",
];
const FOLLOW_UP_SUGGESTIONS = ["A little later", "Direct flights only", "With a checked bag", "Somewhere else"];
const DATE_SUGGESTIONS = ["Tomorrow", "Next Friday", "Next weekend"];
const RETURN_SUGGESTIONS = ["3 days later", "A week later", "Two weeks later"];
const ADD_RETURN = "Add a return flight";

type PlannerTab = "chat" | "flights" | "hotels";

type Props = {
  initialPrompt: string;
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

function removedByFilters(result: FlightSearchResult) {
  return result.unfilteredCount - result.offers.length;
}

const STAY_WORDS = { days: "day", nights: "night", weeks: "week" } as const;

function tripLine(result: FlightSearchResult) {
  const { departure_date: depart, return_date: back, stay_length, stay_unit } = result.query;
  const to = `**${result.destination.city}**`;
  if (!depart) return `A trip to ${to}.`;
  if (!back) return `**One way** to ${to} on ${formatDate(depart)}.`;

  const kind = stay_length && stay_unit ? `${stay_length}-${STAY_WORDS[stay_unit]} trip` : "return trip";
  return `A **${kind}** to ${to}: out ${formatDate(depart)}, back ${formatDate(back)}.`;
}

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

  return `${tripLine(result)}\nI found ${count} ${route}.${matching}\nPrices start at **${formatPrice(cheapest.totalPrice, cheapest.currency)}**${party} with ${cheapest.airline.name}.`;
}

function hotelsMessage({ hotels, totalHotels, stay, sample, filters }: StreamHotels, fallbackCity: string) {
  const wishes = filters?.labels ?? [];
  const city = `**${stay.city ?? fallbackCity}**`;

  if (hotels.length === 0) {
    const found = filters?.unfilteredCount ?? 0;
    return found > 0 && wishes.length > 0
      ? `I found ${found.toLocaleString("en-US")} places to stay in ${city}, but none match what you asked for (${wishes.join(", ")}). Want me to relax one of those?`
      : null;
  }
  if (sample) {
    return `I couldn't reach the hotel search, so I've listed **sample hotels** for ${stay.city ?? fallbackCity}. They are examples, not real availability or prices.`;
  }

  const cheapest = hotels.reduce((best, hotel) => (hotel.nightlyPrice < best.nightlyPrice ? hotel : best));
  const count = `**${totalHotels.toLocaleString("en-US")} place${totalHotels === 1 ? "" : "s"} to stay**`;
  const nightly = formatPrice(cheapest.nightlyPrice, cheapest.currency);
  const matching = wishes.length > 0 ? `\nHotel filters: **${wishes.join(" · ")}**.` : "";

  if (stay.nightsAssumed) {
    return `I also found ${count} in ${city} from ${formatDate(stay.checkIn)}, from **${nightly}** a night.${matching}`;
  }

  const dates = `${formatDate(stay.checkIn)} – ${formatDate(stay.checkOut)}`;
  const stayTotal = formatPrice(cheapest.nightlyPrice * stay.nights, cheapest.currency);
  return `I also found ${count} in ${city} for ${dates}, from **${stayTotal}** for ${formatNights(stay.nights)} (${nightly} a night).${matching}`;
}

export default function PlannerView({ initialPrompt, initialDestination }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (initialPrompt) return [{ id: "initial-user", role: "user", text: initialPrompt }];
    if (initialDestination) {
      const text = `Great choice — **${initialDestination}**! When would you like to travel?`;
      return [{ id: "greeting", role: "assistant", text }];
    }
    return [{ id: WELCOME_ID, role: "assistant", text: WELCOME }];
  });
  const [isSearching, setIsSearching] = useState(Boolean(initialPrompt));
  const [statusLines, setStatusLines] = useState<string[]>([]);
  const [result, setResult] = useState<FlightSearchResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [asking, setAsking] = useState<SearchQuestion | null>(null);
  const [visibleFlights, setVisibleFlights] = useState(FLIGHTS_PAGE_SIZE);
  const [flightSort, setFlightSort] = useState<FlightSort>("best");
  const [hotelSort, setHotelSort] = useState<HotelSort>("recommended");
  const [selectedFlight, setSelectedFlight] = useState<FlightOffer | null>(null);
  const [savingFlightId, setSavingFlightId] = useState<string | null>(null);
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);
  const [tripReady, setTripReady] = useState(false);
  const [tab, setTab] = useState<PlannerTab>("chat");
  const router = useRouter();
  const { user, isSaved, toggleSaved, openAuth } = useAccount();
  const userId = user?.id ?? null;
  const earlierMessages = useChatHistory(userId, messages, [WELCOME_ID]);

  const context = useRef<SearchContext>(initialDestination ? { destination: initialDestination } : {});
  const activeSearch = useRef<AbortController | null>(null);
  const blockedPrompt = useRef<string | null>(null);

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
    setHotelSearch(null);
    setSelectedFlight(null);
    setSelectedHotel(null);
    setTripReady(false);
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
            if (needsInput) context.current.awaiting = next?.awaiting ?? null;
            if (!gotResults && !needsInput) report(CONNECTION_MESSAGE);
          },
          error: ({ message }) => report(message),
        },
        controller.signal,
      );

      if (!sawDone && !gotResults) report(CONNECTION_MESSAGE);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (!(error instanceof SearchRejected)) {
        report(CONNECTION_MESSAGE);
      } else if (error.status === 429 && error.message) {
        const guestLimit = error.reason === "guest_limit";
        if (guestLimit) {
          blockedPrompt.current = prompt;
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

  useEffect(() => {
    if (!initialPrompt) return;
    const start = setTimeout(() => runSearch(initialPrompt), 0);
    return () => clearTimeout(start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => activeSearch.current?.abort(), []);

  useEffect(() => {
    const prompt = blockedPrompt.current;
    if (!userId || !prompt) return;
    const start = setTimeout(() => runSearch(prompt), 0);
    return () => clearTimeout(start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  function send(text: string) {
    if (isRoadTripPrompt(text)) {
      router.push(plannerHref(text));
      return;
    }
    if (text === ADD_RETURN && result?.query.departure_date && !result.query.return_date) {
      const tripQuery = { ...result.query, trip_type: "return" as const };
      delete tripQuery.explanation;
      context.current = { destination: context.current.destination, tripQuery, awaiting: "return_date" };
      addMessage("user", text);
      addMessage("assistant", `Sure. When would you like to come back from **${result.destination.city}**?`);
      setAsking("return_date");
      setTab("chat");
      return;
    }
    addMessage("user", text);
    setTab("chat");
    runSearch(text);
  }

  function tripMessage(flight: FlightOffer, hotel: Hotel, { nights, nightsAssumed }: StreamHotels["stay"]) {
    const stayCost = hotel.nightlyPrice * nights;
    const flightPrice = formatPrice(flight.totalPrice, flight.currency);
    if (nightsAssumed) {
      return `Your trip is taking shape: **${flight.airline.name}** (${flightPrice}) plus **${hotel.name}** at ${formatPrice(hotel.nightlyPrice, hotel.currency)} a night.`;
    }
    const total = tripTotal(flight, hotel, { nights, nightsAssumed });
    return total !== null
      ? `Your trip is taking shape: **${flight.airline.name}** plus **${hotel.name}** comes to **${formatPrice(total, flight.currency)}** in total.`
      : `Your trip is taking shape: **${flight.airline.name}** (${flightPrice}) plus **${hotel.name}** (${formatPrice(stayCost, hotel.currency)} for ${formatNights(nights)}).`;
  }

  async function selectFlight(offer: FlightOffer) {
    if (!user) {
      if (selectedFlight?.id === offer.id) {
        setSelectedFlight(null);
        return;
      }
      setSelectedFlight(offer);
      if (selectedHotel && stay) setTripReady(true);
      const picked =`Good pick! **${offer.airline.name}** ${offer.flightNumber} is ${formatPrice(offer.totalPrice, offer.currency)}. Sign in if you want to save it to your trips.`;
      addMessage(
        "assistant",
        selectedHotel && stay ? `${picked}\n${tripMessage(offer, selectedHotel, stay)}` : `${picked} Now choose where to stay.`,
      );
      return;
    }
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
      if (selectedHotel && stay) setTripReady(true);
      const saved =`Saved! **${offer.airline.name}** ${offer.flightNumber} at ${formatPrice(offer.totalPrice, offer.currency)} is in your saved trips.`;
      addMessage(
        "assistant",
        selectedHotel && stay ? `${saved}\n${tripMessage(offer, selectedHotel, stay)}` : `${saved} Now choose where to stay.`,
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
    if (selectedFlight) setTripReady(true);
    const cost = stay.nightsAssumed
      ? `${formatPrice(hotel.nightlyPrice, hotel.currency)} a night`
      : `${formatPrice(hotel.nightlyPrice * stay.nights, hotel.currency)} for ${formatNights(stay.nights)}`;
    addMessage(
      "assistant",
      selectedFlight
        ? tripMessage(selectedFlight, hotel, stay)
        : `Lovely choice! **${hotel.name}** is ${cost}. Want to pick a flight to go with it?`,
    );
  }

  async function showItinerary(trip: PickedTrip) {
    const id = await createTrip(trip, { sample: hotelSearch?.sample ?? false });
    router.push(`/itinerary/${id}`);
  }

  const flightStatus: FlightSearchStatus = isSearching
    ? "searching"
    : searchError
      ? "error"
      : result
        ? "ready"
        : "idle";

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
    setVisibleFlights(FLIGHTS_PAGE_SIZE);
  }

  const suggestions =
    asking === "departure_date"
      ? DATE_SUGGESTIONS
      : asking === "return_date"
        ? RETURN_SUGGESTIONS
        : result
          ? result.query.return_date
            ? FOLLOW_UP_SUGGESTIONS
            : [ADD_RETURN, ...FOLLOW_UP_SUGGESTIONS]
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
            isSelected={user ? isSaved : (offer) => offer.id === selectedFlight?.id}
            selectedText={user ? "Saved" : "Selected"}
            savingId={savingFlightId}
            onSelect={selectFlight}
          />
        </div>
        <div id="panel-hotels" role="tabpanel" aria-labelledby="tab-hotels" className={`${panelClass("hotels")} bg-white/40`}>
          <HotelResults
            subtitle={
              stay && result
                ? stay.nightsAssumed
                  ? oneWayStaySummary(stay.city ?? result.destination.city, stay.checkIn, hotelSearch?.filters?.labels)
                  : staySummary(stay.city ?? result.destination.city, stay.checkIn, stay.checkOut, stay.nights, hotelSearch?.filters?.labels)
                : isSearching
                  ? "Looking for places to stay"
                  : "Follows your flight search"
            }
            hotels={hotels}
            nights={stay?.nights ?? 1}
            oneWay={stay?.nightsAssumed ?? false}
            status={hotelStatus}
            total={hotelSearch?.totalHotels}
            filteredOut={hotelSearch?.filters ? hotelSearch.filters.unfilteredCount - hotelSearch.totalHotels : 0}
            sample={hotelSearch?.sample}
            sort={hotelSort}
            onSortChange={setHotelSort}
            selectedId={selectedHotel?.id ?? null}
            onSelect={selectHotel}
          />
        </div>
      </div>

      <TripReadyDialog
        trip={tripReady && selectedFlight && selectedHotel && stay ? { flight: selectedFlight, hotel: selectedHotel, stay } : null}
        onShowItinerary={showItinerary}
        onClose={() => setTripReady(false)}
      />
    </div>
  );
}
