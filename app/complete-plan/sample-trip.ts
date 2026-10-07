// Placeholder content for the complete-plan page, which is UI only for now.
// Everything here gets replaced by the traveller's real plan once it is wired up.

export type Scene = "island" | "temple" | "lake" | "beach";

export type FlightLeg = {
  label: string;
  date: string;
  route: string;
  departTime: string;
  departCode: string;
  arriveTime: string;
  arriveCode: string;
  duration: string;
};

export type BudgetLine = {
  label: string;
  amount: number;
  /** Tailwind background class shared by the bar segment and the legend dot. */
  color: string;
};

export type Place = {
  name: string;
  tag: string;
  detail: string;
  scene: Scene;
};

export type PlanDay = {
  day: string;
  text: string;
  /** Tailwind background class for the marker bar. */
  color: string;
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
  title: "Athens Beach Escape",
  airportCode: "ATH",
  vibe: "Beach vibe",
  photoCount: 12,
  description:
    "Seven slow beach days on the Athens Riviera: swims in Glyfada, sunset at Cape Sounion and seafood by the water.",
  chips: ["7 days", "6 nights", "1 traveler"],
  status: "On track",
  facts: [
    { label: "Dates", value: "16 – 22 Oct 2026" },
    { label: "Route", value: "CPH ⇄ ATH" },
    { label: "Stay", value: "Glyfada, Athens" },
  ],
  days: 7,
  budget: [
    { label: "Flights", amount: 420, color: "bg-iris" },
    { label: "Hotel", amount: 840, color: "bg-lavender" },
    { label: "Food & drinks", amount: 360, color: "bg-lavender-soft" },
    { label: "Activities", amount: 240, color: "bg-amber-300" },
  ] satisfies BudgetLine[],
  flight: {
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
    ] satisfies FlightLeg[],
  },
  hotel: {
    price: "6 nights · €840",
    name: "Blue Cove Beach Hotel",
    details: ["Glyfada, Athens", "4★", "120 m to the beach"],
    checkIn: { date: "Fri, 16 Oct", time: "from 15:00" },
    checkOut: { date: "Thu, 22 Oct", time: "until 11:00" },
  },
  calendar: {
    year: 2026,
    /** 1-based, so 10 is October. */
    month: 10,
    today: 7,
    tripStart: 16,
    tripEnd: 22,
    /** Days with something planned get a dot. */
    activityDays: [17, 18, 19, 20, 21],
  },
  plan: {
    summary: "7 days · 16 – 22 Oct",
    days: [
      { day: "Fri 16", text: "Arrive in Athens, hotel check-in", color: "bg-iris" },
      { day: "Sat 17", text: "Morning swim at Glyfada Beach", color: "bg-amber-300" },
      { day: "Sun 18", text: "Cape Sounion temple at sunset", color: "bg-amber-300" },
    ] satisfies PlanDay[],
  },
  mapStops: [
    { label: "Airport ATH", kind: "airport", left: "4.5%", top: "24.5%" },
    { label: "Blue Cove Hotel", kind: "hotel", left: "33%", top: "61.5%" },
    { label: "Cape Sounion", kind: "place", left: "65.5%", top: "82.5%" },
  ] satisfies MapStop[],
  weather: {
    summary: "Athens · 5-day forecast",
    days: [
      { day: "Fri 16", sky: "sun", high: 24, low: 17 },
      { day: "Sat 17", sky: "sun", high: 25, low: 17 },
      { day: "Sun 18", sky: "cloud-sun", high: 23, low: 16 },
      { day: "Mon 19", sky: "sun", high: 24, low: 16 },
      { day: "Tue 20", sky: "rain", high: 21, low: 15 },
    ] satisfies Forecast[],
  },
  places: [
    { name: "Cape Sounion", tag: "Temple", detail: "Temple · sunset", scene: "temple" },
    { name: "Vouliagmeni Lake", tag: "Swim", detail: "Swim · 25 min", scene: "lake" },
    { name: "Glyfada Beach", tag: "Beach", detail: "Beach · 5 min", scene: "beach" },
    { name: "Acropolis", tag: "Temple", detail: "History · 40 min", scene: "temple" },
    { name: "Astir Beach", tag: "Beach", detail: "Beach · 20 min", scene: "beach" },
    { name: "Hydra", tag: "Island", detail: "Day trip · ferry", scene: "island" },
  ] satisfies Place[],
};
