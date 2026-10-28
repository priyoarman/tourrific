"use client";

import Link from "next/link";
import { useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowRightIcon, BedIcon, CloseIcon, HeartIcon, MapPinIcon, PlaneIcon } from "@/app/components/ui/Icons";
import Modal from "@/app/components/ui/Modal";
import type { AuthUser } from "@/app/lib/auth-store";
import { formatDate, formatDateRange, formatPrice, formatTime } from "@/app/lib/format";
import type { SavedTrip } from "@/app/lib/trips";
import type { SavedFlight } from "@/app/lib/types";
import AirlineBadge from "@/app/plan/_components/flights/AirlineBadge";
import SampleBadge from "@/app/plan/_components/results/SampleBadge";

type Props = {
  open: boolean;
  onClose: () => void;
  user: AuthUser | null;
  flights: SavedFlight[];
  status: "loading" | "ready" | "error";
  removingId: string | null;
  onRemove: (flight: SavedFlight) => void;
  trips: SavedTrip[];
  tripsStatus: "loading" | "ready" | "error";
  removingTripId: string | null;
  onRemoveTrip: (trip: SavedTrip) => void;
  onLogOut: () => void;
};

type Section = "trips" | "flights" | "hotels";

const SECTIONS: { value: Section; label: string; icon: ReactNode }[] = [
  { value: "trips", label: "Trips", icon: <MapPinIcon size={15} /> },
  { value: "flights", label: "Flights", icon: <PlaneIcon size={15} /> },
  { value: "hotels", label: "Hotels", icon: <BedIcon size={15} /> },
];

const itemClass = "rounded-3xl border border-lavender-soft/70 bg-white p-4 transition-opacity";
const removeClass =
  "rounded-full px-3 py-1.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:text-ink-subtle";

function SavedTripItem({
  trip,
  removing,
  onRemove,
  onOpen,
}: {
  trip: SavedTrip;
  removing: boolean;
  onRemove: () => void;
  onOpen: () => void;
}) {
  const place = trip.city ?? trip.destination;

  return (
    <li className={`${itemClass} ${removing ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-lavender-soft text-ink">
          <MapPinIcon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 font-semibold text-ink">
            <span className="truncate">{place}</span>
            {trip.sample && <SampleBadge />}
          </h3>
          <p className="truncate text-xs text-ink-muted">
            {trip.origin} → {trip.destination} · {formatDateRange(trip.checkIn, trip.checkOut)}
          </p>
        </div>
        {trip.totalPrice !== null && (
          <p className="text-lg font-bold text-ink">{formatPrice(trip.totalPrice, trip.currency)}</p>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <Link
          href={`/itinerary/${trip.id}`}
          onClick={onOpen}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:bg-lavender-soft/50"
        >
          View itinerary
          <ArrowRightIcon size={15} />
        </Link>
        <button
          type="button"
          onClick={onRemove}
          disabled={removing}
          aria-label={`Remove your trip to ${place}`}
          className={removeClass}
        >
          {removing ? "Removing…" : "Remove"}
        </button>
      </div>
    </li>
  );
}

function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="px-4 pt-14 text-center text-[0.9375rem] text-ink-muted">
      {children}
    </p>
  );
}

function SavedFlightItem({
  flight,
  removing,
  onRemove,
}: {
  flight: SavedFlight;
  removing: boolean;
  onRemove: () => void;
}) {
  const price = flight.currency
    ? formatPrice(flight.price, flight.currency)
    : flight.price.toLocaleString("en-US", { maximumFractionDigits: 2 });

  return (
    <li className={`${itemClass} ${removing ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-3">
        <AirlineBadge airline={flight.airline} />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-ink">
            {flight.origin} → {flight.destination}
          </h3>
          <p className="truncate text-xs text-ink-muted">
            {flight.airline.name} · {flight.flightNumber}
          </p>
        </div>
        <p className="text-lg font-bold text-ink">{price}</p>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          {formatDate(flight.departureTime)} · departs {formatTime(flight.departureTime)}
        </p>
        <button
          type="button"
          onClick={onRemove}
          disabled={removing}
          aria-label={`Remove ${flight.flightNumber}, ${flight.origin} to ${flight.destination}`}
          className={removeClass}
        >
          {removing ? "Removing…" : "Remove"}
        </button>
      </div>
    </li>
  );
}

export default function SavedTripsDrawer({
  open,
  onClose,
  user,
  flights,
  status,
  removingId,
  onRemove,
  trips,
  tripsStatus,
  removingTripId,
  onRemoveTrip,
  onLogOut,
}: Props) {
  const [section, setSection] = useState<Section>("trips");
  const counts: Record<Section, number | null> = {
    trips: tripsStatus === "ready" ? trips.length : null,
    flights: status === "ready" ? flights.length : null,
    hotels: null,
  };

  function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
    const index = SECTIONS.findIndex((s) => s.value === section);
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % SECTIONS.length
        : event.key === "ArrowLeft"
          ? (index - 1 + SECTIONS.length) % SECTIONS.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? SECTIONS.length - 1
              : null;
    if (next === null) return;
    event.preventDefault();
    setSection(SECTIONS[next].value);
    document.getElementById(`saved-tab-${SECTIONS[next].value}`)?.focus();
  }

  return (
    <Modal open={open} onClose={onClose} label="Saved trips" className="mr-0 ml-auto h-dvh max-h-none w-full max-w-md">
      <div className="flex h-full flex-col bg-[#fbf9ff] shadow-[-30px_0_80px_-40px_rgba(42,27,61,0.6)]">
        <header className="flex items-center justify-between gap-3 px-6 pt-6 pb-4">
          <h2 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-ink">
            <span className="flex size-9 items-center justify-center rounded-full bg-lavender-soft text-ink">
              <HeartIcon size={18} />
            </span>
            Saved trips
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close saved trips"
            className="rounded-full p-2 text-ink-muted transition-colors hover:bg-lavender-soft/50 hover:text-ink"
          >
            <CloseIcon size={18} />
          </button>
        </header>

        <div role="tablist" aria-label="What you saved" onKeyDown={moveFocus} className="flex gap-2 px-5 pb-4">
          {SECTIONS.map(({ value, label, icon }) => {
            const active = value === section;
            return (
              <button
                key={value}
                id={`saved-tab-${value}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls="saved-panel"
                tabIndex={active ? 0 : -1}
                onClick={() => setSection(value)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? "border-ink bg-ink text-white"
                    : "border-lavender-soft bg-white text-ink hover:border-lavender"
                }`}
              >
                {icon}
                {label}
                {counts[value] ? (
                  <span className={active ? "text-white/70" : "text-ink-subtle"}>{counts[value]}</span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div
          id="saved-panel"
          role="tabpanel"
          aria-labelledby={`saved-tab-${section}`}
          className="min-h-0 flex-1 overflow-y-auto px-5 pb-6"
        >
          {section === "trips" &&
            (trips.length > 0 ? (
              <ul className="space-y-3">
                {trips.map((trip) => (
                  <SavedTripItem
                    key={trip.id}
                    trip={trip}
                    removing={trip.id === removingTripId}
                    onRemove={() => onRemoveTrip(trip)}
                    onOpen={onClose}
                  />
                ))}
              </ul>
            ) : (
              <EmptyNote>
                {tripsStatus === "loading"
                  ? "Loading your saved trips…"
                  : tripsStatus === "error"
                    ? "Couldn't load your saved trips. Please try again in a moment."
                    : "No saved trips yet. Pick a flight and a hotel, open the itinerary and press Save trip."}
              </EmptyNote>
            ))}

          {section === "flights" &&
            (flights.length > 0 ? (
              <ul className="space-y-3">
                {flights.map((flight) => (
                  <SavedFlightItem
                    key={flight.id}
                    flight={flight}
                    removing={flight.id === removingId}
                    onRemove={() => onRemove(flight)}
                  />
                ))}
              </ul>
            ) : (
              <EmptyNote>
                {status === "loading"
                  ? "Loading your saved flights…"
                  : status === "error"
                    ? "Couldn't load your saved flights. Please try again in a moment."
                    : "No saved flights yet. Press Select on a flight to keep it here."}
              </EmptyNote>
            ))}

          {section === "hotels" && (
            <EmptyNote>
              Saving hotels on their own is coming soon. Until then, a hotel you pick is kept with its trip: save the
              trip from its itinerary.
            </EmptyNote>
          )}
        </div>

        {user && (
          <footer className="flex items-center justify-between gap-3 border-t border-lavender-soft/70 px-6 py-4">
            <p className="min-w-0 text-sm text-ink-muted">
              Signed in as <span className="block truncate font-semibold text-ink">{user.name || user.email}</span>
            </p>
            <button
              type="button"
              onClick={onLogOut}
              className="shrink-0 rounded-full border border-lavender-soft bg-white px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-lavender hover:bg-lavender-soft/40"
            >
              Log Out
            </button>
          </footer>
        )}
      </div>
    </Modal>
  );
}
