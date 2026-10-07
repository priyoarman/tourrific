"use client";

import { useEffect, useRef, useState } from "react";
import { BedIcon, ChatIcon, RouteIcon } from "@/app/components/ui/Icons";
import { formatPrice } from "@/app/lib/format";
import { getHotels } from "@/app/lib/mock-results";
import { buildRoadTrip, resolveRoute, stopAsTrip } from "@/app/lib/road-trips";
import { replyToRoadTrip, ROAD_TRIP_SUGGESTIONS, roadTripWelcome } from "@/app/lib/roadtrip-assistant";
import type { ChatMessage, Hotel, RoadTripRoute } from "@/app/lib/types";
import ChatPanel from "@/app/plan/_components/chat/ChatPanel";
import HotelResults, { staySummary, type HotelSort } from "@/app/plan/_components/hotels/HotelResults";
import MobileTabs from "@/app/plan/_components/MobileTabs";
import RouteColumn from "./route/RouteColumn";
import StopPicker from "./StopPicker";

const REPLY_DELAY_MS = 900;

type RoadTripTab = "chat" | "route" | "hotels";

type Props = {
  initialPrompt: string;
  /** Today's date (YYYY-MM-DD), passed from the server so both renders agree. */
  today: string;
};

let messageCount = 0;
const newId = () => `m${++messageCount}-${Date.now()}`;

export default function RoadTripView({ initialPrompt, today }: Props) {
  const [route, setRoute] = useState<RoadTripRoute>(() => resolveRoute(initialPrompt));
  const trip = buildRoadTrip(route, today);

  const [activeStopId, setActiveStopId] = useState(route.stops[0].id);
  const activeStop = trip.stops.find((s) => s.id === activeStopId) ?? trip.stops[0];
  const stopTrip = stopAsTrip(trip, activeStop);
  const hotels = getHotels(stopTrip);

  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    initialPrompt
      ? [{ id: "initial-user", role: "user", text: initialPrompt }]
      : [{ id: "welcome", role: "assistant", text: roadTripWelcome(trip) }],
  );
  const [isTyping, setIsTyping] = useState(Boolean(initialPrompt));
  const [hotelSort, setHotelSort] = useState<HotelSort>("recommended");
  /** The hotel picked for each overnight stop, keyed by stop id. */
  const [stays, setStays] = useState<Record<string, Hotel>>({});
  const [tab, setTab] = useState<RoadTripTab>("chat");
  const replyTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function addMessage(role: ChatMessage["role"], text: string) {
    setMessages((prev) => [...prev, { id: newId(), role, text }]);
  }

  function respond(text: string, isFirst: boolean) {
    const reply = replyToRoadTrip(text, { trip, isFirst });
    const action = reply.action;

    if (action?.type === "set-route") {
      setRoute(action.route);
      setActiveStopId(action.route.stops[0].id);
      setStays({});
      setHotelSort("recommended");
      // Keep the URL shareable without re-running the server page.
      window.history.replaceState(null, "", `/roadtrip?q=${encodeURIComponent(text)}`);
    } else if (action?.type === "focus-stop") {
      setActiveStopId(action.stopId);
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
    addMessage("user", text);
    setIsTyping(true);
    setTab("chat");
    replyTimer.current = setTimeout(() => respond(text, false), REPLY_DELAY_MS);
  }

  function chooseHotelFor(stopId: string) {
    setActiveStopId(stopId);
    setTab("hotels");
  }

  function selectHotel(hotel: Hotel) {
    const stopId = activeStop.id;
    if (stays[stopId]?.id === hotel.id) {
      setStays((prev) => {
        const rest = { ...prev };
        delete rest[stopId];
        return rest;
      });
      return;
    }

    const next = { ...stays, [stopId]: hotel };
    setStays(next);

    const remaining = trip.stops.filter((s) => !next[s.id]);
    const total = trip.stops.reduce((sum, s) => sum + (next[s.id] ? next[s.id].nightlyPrice * s.nights : 0), 0);
    addMessage(
      "assistant",
      remaining.length
        ? `**${hotel.name}** is lined up for ${activeStop.city}. ${remaining.length === 1 ? "One more stop" : `${remaining.length} more stops`} to go — next up: **${remaining[0].city}**.`
        : `Every night is covered! Your stays along the route come to **${formatPrice(total)}** in total. Happy driving 🚗`,
    );
  }

  const panelClass = (id: RoadTripTab) => `${tab === id ? "flex" : "hidden"} min-h-0 flex-col lg:flex`;

  return (
    <div className="flex h-dvh flex-col">
      <MobileTabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "chat", label: "Chat", icon: <ChatIcon size={16} /> },
          { id: "route", label: "Route", icon: <RouteIcon size={16} />, count: trip.stops.length },
          { id: "hotels", label: "Hotels", icon: <BedIcon size={16} />, count: hotels.length },
        ]}
      />

      <div className="grid min-h-0 flex-1 lg:grid-cols-3 lg:divide-x lg:divide-lavender-soft/70">
        <div id="panel-chat" role="tabpanel" aria-labelledby="tab-chat" className={panelClass("chat")}>
          <ChatPanel messages={messages} isTyping={isTyping} suggestions={ROAD_TRIP_SUGGESTIONS} onSend={send} />
        </div>
        <div id="panel-route" role="tabpanel" aria-labelledby="tab-route" className={`${panelClass("route")} bg-white/40`}>
          <RouteColumn
            trip={trip}
            activeStopId={activeStop.id}
            hotels={stays}
            onSelectStop={setActiveStopId}
            onChooseHotel={chooseHotelFor}
          />
        </div>
        <div id="panel-hotels" role="tabpanel" aria-labelledby="tab-hotels" className={`${panelClass("hotels")} bg-white/40`}>
          <HotelResults
            subtitle={staySummary(activeStop.city, activeStop.arriveDate, activeStop.leaveDate, activeStop.nights)}
            nights={activeStop.nights}
            hotels={hotels}
            sort={hotelSort}
            onSortChange={setHotelSort}
            selectedId={stays[activeStop.id]?.id ?? null}
            onSelect={selectHotel}
            toolbarExtra={
              <StopPicker
                stops={trip.stops}
                activeId={activeStop.id}
                bookedIds={Object.keys(stays)}
                onChange={setActiveStopId}
              />
            }
          />
        </div>
      </div>
    </div>
  );
}
