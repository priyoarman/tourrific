import {
  dayOffset,
  formatDate,
  formatDateRange,
  formatDuration,
  formatNights,
  formatPrice,
  formatTime,
} from "../lib/format.ts";
import { tripTotal } from "../lib/trip-total.ts";
import type { FlightSlice, PickedTrip } from "../lib/types";

export type Scene = "island" | "temple" | "lake" | "beach";

export type ImageView = { photoUrl: string | null; scene: Scene };

export type OverviewView = {
  title: string;
  airportCode: string;
  description: string;
  chips: string[];
  facts: { label: string; value: string }[];
  image: ImageView;
};

export type BudgetLine = {
  label: string;
  amount: number;
  color: string;
};

export type BudgetView = {
  currency: string;
  days: number;
  lines: BudgetLine[];
};

export type FlightLegView = {
  label: string;
  date: string;
  route: string;
  departTime: string;
  departCode: string;
  arriveTime: string;
  arriveCode: string;
  duration: string;
};

export type FlightView = { title: string; price: string; legs: FlightLegView[] };

export type StayDateView = { date: string; time: string | null };

export type HotelStayView = {
  name: string;
  price: string;
  details: string[];
  checkIn: StayDateView;
  checkOut: StayDateView;
  image: ImageView;
  sample: boolean;
};

export type CalendarView = {
  start: string;
  end: string;
  today: string | null;
  activityDates: string[];
};

export type PlanDay = {
  day: string;
  text: string;
  color: string;
};

export type PlanView = { summary: string; days: PlanDay[] };

export type ItineraryView = {
  summary: string[];
  overview: OverviewView;
  budget: BudgetView | null;
  flight: FlightView;
  hotel: HotelStayView;
  calendar: CalendarView;
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

function stopsText(slice: FlightSlice) {
  return slice.stops.length === 0 ? "Direct" : plural(slice.stops.length, "stop");
}

export type CityOf = (airportCode: string) => string | null;

function legView(label: string, slice: FlightSlice, cityOf: CityOf): FlightLegView {
  const offset = dayOffset(slice.departureTime, slice.arrivalTime);
  const lands = offset === 0 ? [] : [offset > 0 ? `+${plural(offset, "day")}` : plural(offset, "day")];
  return {
    label,
    date: formatDate(slice.departureTime),
    route: `${cityOf(slice.origin) ?? slice.origin} → ${cityOf(slice.destination) ?? slice.destination}`,
    departTime: formatTime(slice.departureTime),
    departCode: slice.origin,
    arriveTime: formatTime(slice.arrivalTime),
    arriveCode: slice.destination,
    duration: [formatDuration(slice.durationMinutes), stopsText(slice), ...lands].join(" · "),
  };
}

export function toItineraryView(
  { flight, hotel, stay }: PickedTrip,
  { today, cityOf, sample = false }: { today: string | null; cityOf: CityOf; sample?: boolean },
): ItineraryView {
  const destination = flight.outbound.destination;
  const city = stay.city ?? cityOf(destination) ?? destination;
  const originCity = cityOf(flight.outbound.origin) ?? flight.outbound.origin;
  const roundTrip = flight.inbound !== null;
  const title = `${city} trip`;
  const dates = formatDateRange(stay.checkIn, stay.checkOut);
  const days = stay.nights + 1;
  const travellers = plural(stay.guests, "traveller");
  const hotelCost = hotel.nightlyPrice * stay.nights;
  const total = tripTotal(flight, hotel, stay);

  return {
    summary: roundTrip ? [title, plural(days, "day"), dates] : [title, "One way", formatDate(stay.checkIn)],
    overview: {
      title,
      airportCode: destination,
      description: roundTrip
        ? `${formatNights(stay.nights)} in ${city} at ${hotel.name}, flying ${flight.airline.name} from ${originCity}.`
        : `A one-way flight from ${originCity} with ${flight.airline.name}, and ${formatNights(stay.nights)} at ${hotel.name} to start with.`,
      chips: roundTrip
        ? [plural(days, "day"), formatNights(stay.nights), travellers]
        : ["One way", `${formatNights(stay.nights)} at the hotel`, travellers],
      facts: [
        { label: "Dates", value: roundTrip ? dates : `From ${formatDate(stay.checkIn)}` },
        { label: "Route", value: `${flight.outbound.origin} ${roundTrip ? "⇄" : "→"} ${destination}` },
        { label: "Stay", value: city },
      ],
      image: { photoUrl: hotel.photoUrl, scene: "island" },
    },
    budget:
      total === null
        ? null
        : {
            currency: flight.currency,
            days,
            lines: [
              { label: "Flights", amount: flight.totalPrice, color: "bg-iris" },
              { label: "Hotel", amount: hotelCost, color: "bg-lavender" },
            ],
          },
    flight: {
      title: roundTrip ? "Return flight" : "Flight",
      price: `${formatPrice(flight.totalPrice, flight.currency)} · ${roundTrip ? "round trip" : "one way"}`,
      legs: [
        legView("Outbound", flight.outbound, cityOf),
        ...(flight.inbound ? [legView("Return", flight.inbound, cityOf)] : []),
      ],
    },
    hotel: {
      name: hotel.name,
      price: stay.nightsAssumed
        ? `${formatPrice(hotel.nightlyPrice, hotel.currency)} a night`
        : `${formatNights(stay.nights)} · ${formatPrice(hotelCost, hotel.currency)}`,
      details: [
        hotel.area || city,
        hotel.stars ? `${hotel.stars}★` : null,
        hotel.rating !== null ? `${hotel.rating} / 10` : null,
        hotel.freeCancellation ? "Free cancellation" : null,
      ].filter((detail): detail is string => detail !== null),
      checkIn: { date: formatDate(stay.checkIn), time: null },
      checkOut: { date: formatDate(stay.checkOut), time: null },
      image: { photoUrl: hotel.photoUrl, scene: "island" },
      sample,
    },
    calendar: { start: stay.checkIn, end: stay.checkOut, today, activityDates: [] },
  };
}
