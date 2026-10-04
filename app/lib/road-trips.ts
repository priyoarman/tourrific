import { addDays, ORIGIN } from "./destinations";
import type { DriveLeg, RoadStop, RoadTrip, RoadTripRoute, RoadTripStop, Trip } from "./types";

// Sample routes only, until a real routing API is wired in. Drive legs are
// estimated from straight-line distance, so they stay stable between renders.

export const roadTripRoutes: RoadTripRoute[] = [
  {
    id: "alpine",
    title: "Alpine Lakes & Passes",
    region: "Germany · Austria · Italy",
    keywords: ["alpine", "alps", "austria", "innsbruck", "dolomites", "italy", "mountain", "mountains", "munich", "bavaria"],
    stops: [
      { id: "munich", city: "Munich", country: "Germany", flag: "🇩🇪", lat: 48.137, lng: 11.575, nights: 1, nightlyRate: 150, highlights: ["Beer gardens", "Old town"] },
      { id: "garmisch", city: "Garmisch-Partenkirchen", country: "Germany", flag: "🇩🇪", lat: 47.492, lng: 11.095, nights: 1, nightlyRate: 130, highlights: ["Zugspitze", "Partnach Gorge"] },
      { id: "innsbruck", city: "Innsbruck", country: "Austria", flag: "🇦🇹", lat: 47.269, lng: 11.404, nights: 2, nightlyRate: 125, highlights: ["Nordkette cable car", "Golden Roof"] },
      { id: "cortina", city: "Cortina d'Ampezzo", country: "Italy", flag: "🇮🇹", lat: 46.54, lng: 12.136, nights: 2, nightlyRate: 170, highlights: ["Tre Cime hike", "Lago di Sorapis"] },
      { id: "riva", city: "Riva del Garda", country: "Italy", flag: "🇮🇹", lat: 45.886, lng: 10.841, nights: 2, nightlyRate: 140, highlights: ["Lakeside swims", "Ponale road"] },
    ],
  },
  {
    id: "portugal",
    title: "Atlantic Coast Drive",
    region: "Portugal",
    keywords: ["portugal", "porto", "lisbon", "algarve", "coast", "coastal", "beach", "beaches", "warm", "sun", "sunny", "surf"],
    stops: [
      { id: "porto", city: "Porto", country: "Portugal", flag: "🇵🇹", lat: 41.15, lng: -8.611, nights: 2, nightlyRate: 110, highlights: ["Ribeira", "Port cellars"] },
      { id: "coimbra", city: "Coimbra", country: "Portugal", flag: "🇵🇹", lat: 40.203, lng: -8.41, nights: 1, nightlyRate: 85, highlights: ["University library"] },
      { id: "nazare", city: "Nazaré", country: "Portugal", flag: "🇵🇹", lat: 39.602, lng: -9.071, nights: 1, nightlyRate: 90, highlights: ["Big-wave lookout", "Seafood"] },
      { id: "lisbon", city: "Lisbon", country: "Portugal", flag: "🇵🇹", lat: 38.722, lng: -9.139, nights: 2, nightlyRate: 120, highlights: ["Alfama", "Sintra day trip"] },
      { id: "lagos", city: "Lagos", country: "Portugal", flag: "🇵🇹", lat: 37.102, lng: -8.673, nights: 2, nightlyRate: 115, highlights: ["Ponta da Piedade", "Beach coves"] },
    ],
  },
  {
    id: "highlands",
    title: "Scottish Highlands Loop",
    region: "Scotland",
    keywords: ["scotland", "scottish", "highlands", "edinburgh", "skye", "glasgow", "loch", "lochs"],
    stops: [
      { id: "edinburgh", city: "Edinburgh", country: "Scotland", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", lat: 55.953, lng: -3.188, nights: 2, nightlyRate: 160, highlights: ["Royal Mile", "Arthur's Seat"] },
      { id: "pitlochry", city: "Pitlochry", country: "Scotland", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", lat: 56.703, lng: -3.734, nights: 1, nightlyRate: 105, highlights: ["Whisky distillery"] },
      { id: "inverness", city: "Inverness", country: "Scotland", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", lat: 57.478, lng: -4.224, nights: 1, nightlyRate: 120, highlights: ["Loch Ness"] },
      { id: "skye", city: "Portree, Skye", country: "Scotland", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", lat: 57.412, lng: -6.196, nights: 2, nightlyRate: 140, highlights: ["Old Man of Storr", "Fairy Pools"] },
      { id: "fort-william", city: "Fort William", country: "Scotland", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", lat: 56.82, lng: -5.105, nights: 1, nightlyRate: 110, highlights: ["Glenfinnan Viaduct"] },
      { id: "glasgow", city: "Glasgow", country: "Scotland", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", lat: 55.864, lng: -4.252, nights: 1, nightlyRate: 120, highlights: ["West End", "Kelvingrove"] },
    ],
  },
  {
    id: "fjords",
    title: "Norwegian Fjords",
    region: "Norway",
    keywords: ["norway", "norwegian", "fjord", "fjords", "bergen", "oslo", "geiranger"],
    stops: [
      { id: "oslo", city: "Oslo", country: "Norway", flag: "🇳🇴", lat: 59.913, lng: 10.752, nights: 1, nightlyRate: 170, highlights: ["Opera house", "Vigeland Park"] },
      { id: "lillehammer", city: "Lillehammer", country: "Norway", flag: "🇳🇴", lat: 61.115, lng: 10.466, nights: 1, nightlyRate: 140, highlights: ["Maihaugen"] },
      { id: "geiranger", city: "Geiranger", country: "Norway", flag: "🇳🇴", lat: 62.101, lng: 7.206, nights: 2, nightlyRate: 190, highlights: ["Eagle Road", "Fjord cruise"] },
      { id: "alesund", city: "Ålesund", country: "Norway", flag: "🇳🇴", lat: 62.472, lng: 6.149, nights: 1, nightlyRate: 150, highlights: ["Art nouveau town", "Mount Aksla"] },
      { id: "bergen", city: "Bergen", country: "Norway", flag: "🇳🇴", lat: 60.391, lng: 5.322, nights: 2, nightlyRate: 165, highlights: ["Bryggen", "Fløyen"] },
    ],
  },
];

const DEFAULT_ROUTE = roadTripRoutes[0];

// Roads wind, so real driving distance is roughly a third longer than straight-line.
const ROAD_FACTOR = 1.35;
const AVERAGE_KMH = 68;

function straightLineKm(a: RoadStop, b: RoadStop) {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function driveLeg(from: RoadStop, to: RoadStop): DriveLeg {
  const km = straightLineKm(from, to) * ROAD_FACTOR;
  return {
    km: Math.round(km / 5) * 5,
    minutes: Math.round(((km / AVERAGE_KMH) * 60) / 5) * 5,
  };
}

export function findRoute(prompt: string): RoadTripRoute | undefined {
  const text = prompt.toLowerCase();
  return roadTripRoutes.find((r) => r.keywords.some((k) => new RegExp(`\\b${k}\\b`).test(text)));
}

export function resolveRoute(prompt: string): RoadTripRoute {
  return findRoute(prompt) ?? DEFAULT_ROUTE;
}

/** Picks a different route than the current one, for "Surprise me". */
export function surpriseRoute(current: RoadTripRoute): RoadTripRoute {
  const index = roadTripRoutes.findIndex((r) => r.id === current.id);
  return roadTripRoutes[(index + 1) % roadTripRoutes.length];
}

export function buildRoadTrip(route: RoadTripRoute, today: string): RoadTrip {
  const startDate = addDays(today, 14);
  let date = startDate;

  const stops: RoadTripStop[] = route.stops.map((stop, i) => {
    const arriveDate = date;
    date = addDays(date, stop.nights);
    return { ...stop, arriveDate, leaveDate: date, leg: i > 0 ? driveLeg(route.stops[i - 1], stop) : null };
  });

  return {
    route,
    stops,
    startDate,
    endDate: date,
    nights: stops.reduce((sum, s) => sum + s.nights, 0),
    totalKm: stops.reduce((sum, s) => sum + (s.leg?.km ?? 0), 0),
    totalDriveMinutes: stops.reduce((sum, s) => sum + (s.leg?.minutes ?? 0), 0),
    travelers: 1,
  };
}

/** Describes one overnight stop as a Trip, so the hotel search and cards can be reused. */
export function stopAsTrip(trip: RoadTrip, stop: RoadTripStop): Trip {
  return {
    origin: ORIGIN,
    destination: {
      city: stop.city,
      country: stop.country,
      flag: stop.flag,
      airport: stop.id,
      flightMinutes: 0,
      basePrice: 0,
      nightlyRate: stop.nightlyRate,
      keywords: [],
    },
    departDate: stop.arriveDate,
    returnDate: stop.leaveDate,
    nights: stop.nights,
    travelers: trip.travelers,
  };
}
