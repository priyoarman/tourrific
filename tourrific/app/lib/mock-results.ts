import type { Airline, FlightOffer, FlightSlice, Hotel, Trip } from "./types";

// Sample data only. Results are seeded by destination so they stay stable
// between renders (and between server and client) until a real API is wired in.

function seededRandom(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const airlines: (Airline & { hub: string })[] = [
  { name: "SAS", code: "SK", color: "#1f3f8f", hub: "OSL" },
  { name: "Norwegian", code: "DY", color: "#d8232a", hub: "OSL" },
  { name: "Lufthansa", code: "LH", color: "#0a1d3d", hub: "FRA" },
  { name: "KLM", code: "KL", color: "#00a1de", hub: "AMS" },
  { name: "Air France", code: "AF", color: "#002157", hub: "CDG" },
  { name: "Swiss", code: "LX", color: "#e3000f", hub: "ZRH" },
  { name: "Finnair", code: "AY", color: "#0b1560", hub: "HEL" },
  { name: "Austrian", code: "OS", color: "#c8102e", hub: "VIE" },
];

const departureTimes = ["06:10", "07:45", "09:30", "12:15", "15:40", "18:05", "20:20"];

function makeSlice(
  date: string,
  from: string,
  to: string,
  departure: string,
  baseMinutes: number,
  stopAirport: string | null,
  layover: number,
): FlightSlice {
  const duration = baseMinutes + (stopAirport ? layover + 35 : 0);
  const start = new Date(`${date}T${departure}:00Z`);
  const end = new Date(start.getTime() + duration * 60_000);
  return {
    origin: from,
    destination: to,
    departureTime: start.toISOString(),
    arrivalTime: end.toISOString(),
    durationMinutes: duration,
    stops: stopAirport ? [{ airport: stopAirport, layoverMinutes: layover }] : [],
  };
}

export function getFlightOffers(trip: Trip): FlightOffer[] {
  const { destination: dest, origin } = trip;
  const rand = seededRandom(`flights-${dest.city}`);
  const isLongHaul = dest.flightMinutes > 480;

  return Array.from({ length: 7 }, (_, i) => {
    const airline = airlines[Math.floor(rand() * airlines.length)];
    const hasStop = isLongHaul ? i !== 2 : i % 3 === 1;
    const stop = hasStop && airline.hub !== dest.airport ? airline.hub : null;
    const layover = 55 + Math.floor(rand() * 8) * 20;
    const outTime = departureTimes[i % departureTimes.length];
    const backTime = departureTimes[(i * 3 + 2) % departureTimes.length];

    // Direct flights cost more; a small random spread keeps the list realistic.
    const factor = (stop ? 0.85 : 1.15) + rand() * 0.6;
    const totalPrice = Math.round(dest.basePrice * 2 * factor * trip.travelers);

    return {
      id: `${dest.airport}-${i}`,
      airline: { name: airline.name, code: airline.code, color: airline.color },
      outbound: makeSlice(
        trip.departDate,
        origin.airport,
        dest.airport,
        outTime,
        dest.flightMinutes,
        stop,
        layover,
      ),
      inbound: makeSlice(
        trip.returnDate,
        dest.airport,
        origin.airport,
        backTime,
        dest.flightMinutes + 10,
        stop,
        layover + 20,
      ),
      totalPrice,
      currency: "USD",
      cabin: "Economy",
      baggage: rand() > 0.5 ? "Cabin bag + 23kg" : "Cabin bag only",
    };
  });
}

const hotelNames = [
  "Hotel Aurora",
  "The Linden House",
  "Casa Marea",
  "Harbour Lights Hotel",
  "Villa Serena",
  "The Atelier Rooms",
  "Old Town Suites",
  "Nordlys Boutique Hotel",
  "The Courtyard Residence",
];

const areas = ["City centre", "Old town", "Waterfront", "Arts district", "Near main station"];

const amenityPool = ["Free Wi-Fi", "Breakfast", "Pool", "Gym", "Spa", "Rooftop bar", "Parking"];

const gradients = [
  "from-[#f6c79b] to-[#d9776b]",
  "from-[#a8c8f0] to-[#5f7fd1]",
  "from-[#c7b2f5] to-[#8b6ad8]",
  "from-[#9fdcc7] to-[#3f9a86]",
  "from-[#f3b6c8] to-[#c46a8e]",
  "from-[#f2dfa0] to-[#c99a45]",
];

export function getHotels(trip: Trip): Hotel[] {
  const dest = trip.destination;
  const rand = seededRandom(`hotels-${dest.city}`);
  const names = hotelNames
    .map((name) => ({ name, order: rand() }))
    .sort((a, b) => a.order - b.order)
    .slice(0, 6)
    .map((h) => h.name);

  return names.map((name, i) => {
    const stars = 3 + Math.floor(rand() * 3);
    const rating = Math.round((7.8 + rand() * 1.8) * 10) / 10;
    const amenities = amenityPool.filter(() => rand() > 0.55).slice(0, 3);
    return {
      id: `${dest.airport}-hotel-${i}`,
      name,
      area: areas[Math.floor(rand() * areas.length)],
      distanceKm: Math.round((0.3 + rand() * 3) * 10) / 10,
      stars,
      rating,
      reviewCount: 180 + Math.floor(rand() * 2400),
      nightlyPrice: Math.round(
        dest.nightlyRate * (0.55 + (stars - 3) * 0.3 + rand() * 0.4),
      ),
      amenities: amenities.length ? amenities : ["Free Wi-Fi"],
      gradient: gradients[i % gradients.length],
      freeCancellation: rand() > 0.4,
    };
  });
}
