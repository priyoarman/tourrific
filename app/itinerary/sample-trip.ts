// Placeholder content for the sample itinerary at /itinerary. A real trip fills
// the same cards through `toItineraryView`; the places, map and weather are only
// sample content for now.
import type { ItineraryView, PlanView, Scene } from "./itinerary-view";

export type Place = {
  name: string;
  tag: string;
  detail: string;
  scene: Scene;
};

export type Forecast = {
  day: string;
  sky: "sun" | "cloud-sun" | "rain";
  high: number;
  low: number;
};

export type MapStop = {
  label: string;
  kind: "airport" | "hotel" | "place";
  /** Where the pin's left edge and vertical centre sit, as a share of the map. */
  left: string;
  top: string;
};

export const sampleTrip = {
  summary: ["Greece beach trip", "7 days", "16 – 22 Oct 2026"],
  travellerInitials: "AH",
  overview: {
    title: "Athens Beach Escape",
    airportCode: "ATH",
    description:
      "Seven slow beach days on the Athens Riviera: swims in Glyfada, sunset at Cape Sounion and seafood by the water.",
    chips: ["7 days", "6 nights", "1 traveler"],
    facts: [
      { label: "Dates", value: "16 – 22 Oct 2026" },
      { label: "Route", value: "CPH ⇄ ATH" },
      { label: "Stay", value: "Glyfada, Athens" },
    ],
    image: { photoUrl: null, scene: "island" },
    vibe: "Beach vibe",
    photoCount: 12,
    status: "On track",
  },
  budget: {
    currency: "EUR",
    days: 7,
    lines: [
      { label: "Flights", amount: 420, color: "bg-iris" },
      { label: "Hotel", amount: 840, color: "bg-lavender" },
      { label: "Food & drinks", amount: 360, color: "bg-lavender-soft" },
      { label: "Activities", amount: 240, color: "bg-amber-300" },
    ],
  },
  flight: {
    title: "Return flight",
    price: "€420 · round trip",
    legs: [
      {
        label: "Outbound",
        date: "Fri, 16 Oct",
        route: "Copenhagen → Athens",
        departTime: "07:10",
        departCode: "CPH",
        arriveTime: "11:30",
        arriveCode: "ATH",
        duration: "3h 20m · Direct",
      },
      {
        label: "Return",
        date: "Thu, 22 Oct",
        route: "Athens → Copenhagen",
        departTime: "12:20",
        departCode: "ATH",
        arriveTime: "14:45",
        arriveCode: "CPH",
        duration: "3h 25m · Direct",
      },
    ],
  },
  hotel: {
    name: "Blue Cove Beach Hotel",
    price: "6 nights · €840",
    details: ["Glyfada, Athens", "4★", "120 m to the beach"],
    checkIn: { date: "Fri, 16 Oct", time: "from 15:00" },
    checkOut: { date: "Thu, 22 Oct", time: "until 11:00" },
    image: { photoUrl: null, scene: "island" },
    sample: true,
  },
  calendar: {
    start: "2026-10-16",
    end: "2026-10-22",
    today: "2026-10-07",
    activityDates: ["2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21"],
  },
  plan: {
    summary: "7 days · 16 – 22 Oct",
    days: [
      { day: "Fri 16", text: "Arrive in Athens, hotel check-in", color: "bg-iris" },
      { day: "Sat 17", text: "Morning swim at Glyfada Beach", color: "bg-amber-300" },
      { day: "Sun 18", text: "Cape Sounion temple at sunset", color: "bg-amber-300" },
    ],
  },
  mapStops: [
    { label: "Airport ATH", kind: "airport", left: "4.5%", top: "24.5%" },
    { label: "Blue Cove Hotel", kind: "hotel", left: "33%", top: "61.5%" },
    { label: "Cape Sounion", kind: "place", left: "65.5%", top: "82.5%" },
  ],
  weather: {
    summary: "Athens · 5-day forecast",
    days: [
      { day: "Fri 16", sky: "sun", high: 24, low: 17 },
      { day: "Sat 17", sky: "sun", high: 25, low: 17 },
      { day: "Sun 18", sky: "cloud-sun", high: 23, low: 16 },
      { day: "Mon 19", sky: "sun", high: 24, low: 16 },
      { day: "Tue 20", sky: "rain", high: 21, low: 15 },
    ],
  },
  places: [
    { name: "Cape Sounion", tag: "Temple", detail: "Temple · sunset", scene: "temple" },
    { name: "Vouliagmeni Lake", tag: "Swim", detail: "Swim · 25 min", scene: "lake" },
    { name: "Glyfada Beach", tag: "Beach", detail: "Beach · 5 min", scene: "beach" },
    { name: "Acropolis", tag: "Temple", detail: "History · 40 min", scene: "temple" },
    { name: "Astir Beach", tag: "Beach", detail: "Beach · 20 min", scene: "beach" },
    { name: "Hydra", tag: "Island", detail: "Day trip · ferry", scene: "island" },
  ],
} satisfies ItineraryView & {
  travellerInitials: string;
  plan: PlanView;
  mapStops: MapStop[];
  weather: { summary: string; days: Forecast[] };
  places: Place[];
};
