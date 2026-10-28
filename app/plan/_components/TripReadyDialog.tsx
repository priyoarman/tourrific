"use client";

import { useState } from "react";
import { ArrowRightIcon, CloseIcon, LuggageIcon, MapPinIcon } from "@/app/components/ui/Icons";
import Modal from "@/app/components/ui/Modal";
import { formatDate, formatNights, formatPrice } from "@/app/lib/format";
import { tripTotal } from "@/app/lib/trip-total";
import type { FlightOffer, Hotel, PickedTrip } from "@/app/lib/types";
import AirlineBadge from "./flights/AirlineBadge";
import FlightLeg from "./flights/FlightLeg";
import StarRating from "./hotels/StarRating";

type Props = {
  trip: PickedTrip | null;
  onShowItinerary: (trip: PickedTrip) => Promise<void>;
  onClose: () => void;
};

const boxClass = "rounded-2xl border border-lavender-soft/70 bg-white p-4";

function FlightSummary({ flight }: { flight: FlightOffer }) {
  return (
    <section aria-label="Your flight" className={boxClass}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <AirlineBadge airline={flight.airline} />
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-ink">{flight.airline.name}</h3>
            <p className="truncate text-xs text-ink-muted">
              {[flight.flightNumber, flight.cabin, flight.inbound ? "Round trip" : "One way"].join(" · ")}
            </p>
          </div>
        </div>
        <p className="shrink-0 text-right">
          <span className="block text-lg font-bold text-ink">{formatPrice(flight.totalPrice, flight.currency)}</span>
          <span className="text-xs text-ink-muted">total</span>
        </p>
      </div>

      <div className="mt-4 space-y-3">
        <FlightLeg slice={flight.outbound} />
        {flight.inbound && (
          <>
            <div className="border-t border-dashed border-lavender-soft" />
            <FlightLeg slice={flight.inbound} />
          </>
        )}
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-muted">
        <LuggageIcon size={15} />
        {flight.baggage}
      </p>
    </section>
  );
}

function HotelSummary({ hotel, stay }: { hotel: Hotel; stay: PickedTrip["stay"] }) {
  const [brokenPhoto, setBrokenPhoto] = useState<string | null>(null);
  const photo = hotel.photoUrl && hotel.photoUrl !== brokenPhoto ? hotel.photoUrl : null;
  const dates = stay.nightsAssumed
    ? `From ${formatDate(stay.checkIn)}`
    : `${formatDate(stay.checkIn)} – ${formatDate(stay.checkOut)} · ${formatNights(stay.nights)}`;

  return (
    <section aria-label="Your hotel" className={boxClass}>
      <div className="flex gap-3">
        <div className={`relative size-16 shrink-0 overflow-hidden rounded-xl bg-linear-to-br ${hotel.gradient}`}>
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt=""
              onError={() => setBrokenPhoto(photo)}
              className="absolute inset-0 size-full object-cover"
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate font-semibold text-ink">{hotel.name}</h3>
              {hotel.stars !== null && (
                <div className="mt-1">
                  <StarRating stars={hotel.stars} />
                </div>
              )}
            </div>
            <p className="shrink-0 text-right">
              <span className="block text-lg font-bold text-ink">
                {formatPrice(stay.nightsAssumed ? hotel.nightlyPrice : hotel.nightlyPrice * stay.nights, hotel.currency)}
              </span>
              <span className="text-xs text-ink-muted">{stay.nightsAssumed ? "per night" : formatNights(stay.nights)}</span>
            </p>
          </div>
          {hotel.area && (
            <p className="mt-1 flex items-center gap-1 truncate text-xs text-ink-muted">
              <MapPinIcon size={13} />
              {hotel.area}
            </p>
          )}
          <p className="mt-1 text-xs text-ink-muted">{dates}</p>
        </div>
      </div>
    </section>
  );
}

function Summary({ trip, onShowItinerary, onClose }: Props & { trip: PickedTrip }) {
  const { flight, hotel, stay } = trip;
  const total = tripTotal(flight, hotel, stay);
  const city = stay.city ?? flight.outbound.destination;
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function showItinerary() {
    setOpening(true);
    setError(null);
    try {
      await onShowItinerary(trip);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Couldn't build your itinerary. Please try again.");
      setOpening(false);
    }
  }

  return (
    <div className="relative rounded-3xl border border-lavender-soft/70 bg-[#fbf9ff] p-6 shadow-[0_30px_80px_-30px_rgba(42,27,61,0.6)] sm:p-8">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 rounded-full p-2 text-ink-muted transition-colors hover:bg-lavender-soft/50 hover:text-ink"
      >
        <CloseIcon size={18} />
      </button>

      <p className="text-sm font-bold tracking-tight text-ink">
        Tourrific <span aria-hidden className="text-[0.7em]">✦</span>
      </p>
      <h2 className="mt-3 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Your trip is taking shape</h2>
      <p className="mt-2 text-[0.9375rem] text-ink-muted">Here&apos;s what you picked for {city}.</p>

      <div className="mt-5 space-y-3">
        <FlightSummary flight={flight} />
        <HotelSummary hotel={hotel} stay={stay} />
      </div>

      {total !== null && (
        <p className="mt-4 flex items-baseline justify-between gap-3 px-1">
          <span className="text-[0.9375rem] font-semibold text-ink">Flight and hotel</span>
          <span className="text-2xl font-bold text-ink">{formatPrice(total, flight.currency)}</span>
        </p>
      )}

      {error && (
        <p id="trip-ready-error" role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={showItinerary}
        disabled={opening}
        aria-describedby={error ? "trip-ready-error" : undefined}
        autoFocus
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-ink py-3.5 text-base font-semibold text-white transition-colors hover:bg-ink/90 disabled:bg-ink/70"
      >
        {opening ? (
          "Building your itinerary…"
        ) : (
          <>
            Show my itinerary
            <ArrowRightIcon size={18} />
          </>
        )}
      </button>
      <button
        type="button"
        onClick={onClose}
        className="mt-2 w-full rounded-full py-3 text-[0.9375rem] font-semibold text-ink-muted transition-colors hover:bg-lavender-soft/40 hover:text-ink"
      >
        I have still not decided
      </button>
    </div>
  );
}

export default function TripReadyDialog(props: Props) {
  const { trip, onClose } = props;
  return (
    <Modal open={trip !== null} onClose={onClose} label="Your trip" className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-3xl">
      {trip && <Summary {...props} trip={trip} />}
    </Modal>
  );
}
