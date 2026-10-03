"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BedIcon, ChatIcon, PlaneIcon } from "@/app/components/ui/Icons";
import { DEFAULT_SUGGESTIONS, replyTo, welcomeMessage } from "@/app/lib/assistant";
import { buildTrip, resolveDestination } from "@/app/lib/destinations";
import { formatPrice } from "@/app/lib/format";
import { getFlightOffers, getHotels } from "@/app/lib/mock-results";
import { isRoadTripPrompt, plannerHref } from "@/app/lib/routes";
import type { ChatMessage, Destination, FlightOffer, Hotel } from "@/app/lib/types";
import ChatPanel from "./chat/ChatPanel";
import FlightResults, { type FlightSort } from "./flights/FlightResults";
import HotelResults, { type HotelSort } from "./hotels/HotelResults";
import MobileTabs from "./MobileTabs";

const REPLY_DELAY_MS = 900;

type PlannerTab = "chat" | "flights" | "hotels";

type Props = {
  initialPrompt: string;
  /** Today's date (YYYY-MM-DD), passed from the server so both renders agree. */
  today: string;
};

let messageCount = 0;
const newId = () => `m${++messageCount}-${Date.now()}`;

export default function PlannerView({ initialPrompt, today }: Props) {
  const [destination, setDestination] = useState<Destination>(() => resolveDestination(initialPrompt));
  const trip = buildTrip(destination, today);
  const flights = getFlightOffers(trip);
  const hotels = getHotels(trip);

  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    initialPrompt
      ? [{ id: "initial-user", role: "user", text: initialPrompt }]
      : [{ id: "welcome", role: "assistant", text: welcomeMessage(trip) }],
  );
  const [isTyping, setIsTyping] = useState(Boolean(initialPrompt));
  const [flightSort, setFlightSort] = useState<FlightSort>("best");
  const [hotelSort, setHotelSort] = useState<HotelSort>("recommended");
  const [selectedFlight, setSelectedFlight] = useState<FlightOffer | null>(null);
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);
  const [tab, setTab] = useState<PlannerTab>("chat");
  const replyTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const router = useRouter();

  function addMessage(role: ChatMessage["role"], text: string) {
    setMessages((prev) => [...prev, { id: newId(), role, text }]);
  }

  function respond(text: string, isFirst: boolean) {
    const reply = replyTo(text, { trip, flights, hotels, isFirst });
    const action = reply.action;

    if (action?.type === "set-destination") {
      setDestination(action.destination);
      setSelectedFlight(null);
      setSelectedHotel(null);
      setFlightSort("best");
      setHotelSort("recommended");
      // Keep the URL shareable without re-running the server page.
      window.history.replaceState(null, "", `/plan?q=${encodeURIComponent(text)}`);
    } else if (action?.type === "sort-flights") {
      setFlightSort(action.sort);
    } else if (action?.type === "sort-hotels") {
      setHotelSort(action.sort);
    }

    addMessage("assistant", reply.text);
    setIsTyping(false);
  }

  // Answer the prompt the visitor arrived with from the landing page.
  useEffect(() => {
    if (!initialPrompt) return;
    replyTimer.current = setTimeout(() => respond(initialPrompt, true), REPLY_DELAY_MS);
    return () => clearTimeout(replyTimer.current);
    // Runs once per mount; `key` on this component resets it for a new prompt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => clearTimeout(replyTimer.current), []);

  function send(text: string) {
    // Road trips are planned on their own page, with a route map instead of flights.
    if (isRoadTripPrompt(text)) {
      router.push(plannerHref(text));
      return;
    }
    addMessage("user", text);
    setIsTyping(true);
    setTab("chat");
    replyTimer.current = setTimeout(() => respond(text, false), REPLY_DELAY_MS);
  }

  function selectFlight(offer: FlightOffer) {
    if (selectedFlight?.id === offer.id) {
      setSelectedFlight(null);
      return;
    }
    setSelectedFlight(offer);
    addMessage(
      "assistant",
      selectedHotel
        ? `Your trip is taking shape: **${offer.airline.name}** plus **${selectedHotel.name}** comes to **${formatPrice(offer.totalPrice + selectedHotel.nightlyPrice * trip.nights)}** in total.`
        : `Nice pick! **${offer.airline.name}** at ${formatPrice(offer.totalPrice)} is in your trip. Now choose where to stay.`,
    );
  }

  function selectHotel(hotel: Hotel) {
    if (selectedHotel?.id === hotel.id) {
      setSelectedHotel(null);
      return;
    }
    setSelectedHotel(hotel);
    const stay = hotel.nightlyPrice * trip.nights;
    addMessage(
      "assistant",
      selectedFlight
        ? `Your trip is taking shape: **${selectedFlight.airline.name}** plus **${hotel.name}** comes to **${formatPrice(selectedFlight.totalPrice + stay)}** in total.`
        : `Lovely choice! **${hotel.name}** is ${formatPrice(stay)} for ${trip.nights} nights. Want to pick a flight to go with it?`,
    );
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
          { id: "flights", label: "Flights", icon: <PlaneIcon size={16} />, count: flights.length },
          { id: "hotels", label: "Hotels", icon: <BedIcon size={16} />, count: hotels.length },
        ]}
      />

      <div className="grid min-h-0 flex-1 lg:grid-cols-3 lg:divide-x lg:divide-lavender-soft/70">
        <div id="panel-chat" role="tabpanel" aria-labelledby="tab-chat" className={panelClass("chat")}>
          <ChatPanel
            messages={messages}
            isTyping={isTyping}
            suggestions={DEFAULT_SUGGESTIONS}
            onSend={send}
          />
        </div>
        <div id="panel-flights" role="tabpanel" aria-labelledby="tab-flights" className={`${panelClass("flights")} bg-white/40`}>
          <FlightResults
            trip={trip}
            offers={flights}
            sort={flightSort}
            onSortChange={setFlightSort}
            selectedId={selectedFlight?.id ?? null}
            onSelect={selectFlight}
          />
        </div>
        <div id="panel-hotels" role="tabpanel" aria-labelledby="tab-hotels" className={`${panelClass("hotels")} bg-white/40`}>
          <HotelResults
            trip={trip}
            hotels={hotels}
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
