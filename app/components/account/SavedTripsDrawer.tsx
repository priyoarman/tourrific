"use client";

import { CloseIcon, HeartIcon } from "@/app/components/ui/Icons";
import Modal from "@/app/components/ui/Modal";
import type { AuthUser } from "@/app/lib/auth-store";
import { formatDate, formatPrice, formatTime } from "@/app/lib/format";
import type { SavedFlight } from "@/app/lib/types";
import AirlineBadge from "@/app/plan/_components/flights/AirlineBadge";

type Props = {
  open: boolean;
  onClose: () => void;
  user: AuthUser | null;
  flights: SavedFlight[];
  status: "loading" | "ready" | "error";
  /** The flight being removed right now, if any. */
  removingId: string | null;
  onRemove: (flight: SavedFlight) => void;
  onLogOut: () => void;
};

function SavedFlightItem({ flight, removing, onRemove }: { flight: SavedFlight; removing: boolean; onRemove: () => void }) {
  const price = flight.currency
    ? formatPrice(flight.price, flight.currency)
    : flight.price.toLocaleString("en-US", { maximumFractionDigits: 2 });

  return (
    <li className={`rounded-3xl border border-lavender-soft/70 bg-white p-4 transition-opacity ${removing ? "opacity-50" : ""}`}>
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
          className="rounded-full px-3 py-1.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:text-ink-subtle"
        >
          {removing ? "Removing…" : "Remove"}
        </button>
      </div>
    </li>
  );
}

/** The "Saved trips" panel: slides in from the right and lists the user's saved flights. */
export default function SavedTripsDrawer({ open, onClose, user, flights, status, removingId, onRemove, onLogOut }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      label="Saved trips"
      className="mr-0 ml-auto h-dvh max-h-none w-full max-w-md"
    >
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

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
          {flights.length > 0 ? (
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
            <p role="status" className="px-4 pt-14 text-center text-[0.9375rem] text-ink-muted">
              {status === "loading"
                ? "Loading your saved flights…"
                : status === "error"
                  ? "Couldn't load your saved flights. Please try again in a moment."
                  : "No saved flights yet. Press Select on a flight to keep it here."}
            </p>
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
