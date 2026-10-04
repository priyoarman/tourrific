// Turns what the visitor asked for (a city name, a country, a region, or a
// mood like "beaches") into one airport code to search.
// Ported from api/src/utils/destinationResolver.js.
import type { TripQuery } from "../types/trip-query";
import { AIRPORT_TYPE_PRIORITY, airports, type Airport } from "./airports.ts";

const COUNTRY_NAMES: Record<string, string> = {
  IN: "India",
  ES: "Spain",
  DE: "Germany",
  FR: "France",
  IT: "Italy",
  GB: "the United Kingdom",
  US: "the United States",
  DK: "Denmark",
  NL: "the Netherlands",
  SE: "Sweden",
  NO: "Norway",
  FI: "Finland",
  PT: "Portugal",
  GR: "Greece",
  HR: "Croatia",
  MT: "Malta",
  CY: "Cyprus",
  AT: "Austria",
  CH: "Switzerland",
  BE: "Belgium",
  IE: "Ireland",
  JP: "Japan",
  TH: "Thailand",
  ID: "Indonesia",
  MY: "Malaysia",
  SG: "Singapore",
  VN: "Vietnam",
  PH: "the Philippines",
  NP: "Nepal",
  LK: "Sri Lanka",
  MV: "the Maldives",
  IS: "Iceland",
  CA: "Canada",
  BR: "Brazil",
  MX: "Mexico",
  JM: "Jamaica",
  DO: "the Dominican Republic",
  BS: "the Bahamas",
  NZ: "New Zealand",
  AU: "Australia",
  KH: "Cambodia"
};

const VIBE_AIRPORTS: Record<string, string[]> = {
  beaches: ["BCN", "PMI", "IBZ", "AGP", "ALC", "NCE", "SPU", "DBV", "ATH", "FAO", "GOI", "HKT", "DPS", "MLE", "CEB", "DAD", "MIA", "HNL", "CUN", "GIG", "MBJ", "PUJ", "NAS"],
  hills: ["GVA", "ZRH", "MUC", "INN", "SZG", "SOF", "MXP", "TRN", "KTM", "SXR", "PKR", "CNX", "ALA", "DEN", "SLC", "YVR", "YYC", "BRC"],
  cozy: ["KEF", "EDI", "OSL", "BGO", "ARN", "CPH", "SZG", "RVN", "KIX", "CTS", "TPE", "BTV", "PDX", "SEA", "YQB", "ZQN"],
  "summer vibes": ["IBZ", "PMI", "AGP", "ATH", "FCO", "LIS", "BCN", "NCE", "HER", "RHO", "MIA", "LAX", "SAN", "MCO", "HNL", "GIG", "DPS", "HKT", "GOI"]
};

const DESTINATION_ALIASES: Record<string, string> = {
  "PALMA": "PMI",
  "PALMA DE MALLORCA": "PMI",
  "MAJORCA": "PMI",
  "MALLORCA": "PMI",
  "NEW YORK": "JFK",
  "LONDON": "LHR",
  "PARIS": "CDG",
  "ROME": "FCO",
  "MILAN": "MXP",
  "BARCELONA": "BCN",
  "MADRID": "MAD",
  "AMSTERDAM": "AMS",
  "ATHENS": "ATH",
  "ISTANBUL": "IST",
  "LISBON": "LIS",
  "COPENHAGEN": "CPH"
};

function normalizeLocationName(value: string | null | undefined) {
  return String(value || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickBestAirport(candidates: Airport[]) {
  if (candidates.length === 0) return null;

  // Array.sort is stable, so airports of the same size keep their list order.
  const ranked = [...candidates].sort(
    (a, b) => (AIRPORT_TYPE_PRIORITY[a.type] ?? 9) - (AIRPORT_TYPE_PRIORITY[b.type] ?? 9),
  );

  return ranked[0]?.iata_code?.toUpperCase() || null;
}

function findAirportByNameOrCity(value: string) {
  const normalized = normalizeLocationName(value);
  if (!normalized) return null;

  if (DESTINATION_ALIASES[normalized]) return DESTINATION_ALIASES[normalized];

  const candidates = airports.filter((airport) => {
    if (!airport.iata_code || airport.scheduled_service !== "yes") return false;

    const municipality = normalizeLocationName(airport.municipality);
    const airportName = normalizeLocationName(airport.name);

    return (
      municipality === normalized ||
      airportName === normalized ||
      municipality.includes(normalized) ||
      normalized.includes(municipality) ||
      airportName.includes(normalized) ||
      normalized.includes(airportName)
    );
  });

  return pickBestAirport(candidates);
}

/** "BCN" → "BCN", "Barcelona" → "BCN", "Palma de Mallorca" → "PMI". Null when nothing matches. */
export function resolveDestinationAirportInput(value: string | null | undefined) {
  if (value == null) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  const upper = raw.toUpperCase();
  if (/^[A-Z]{3}$/.test(upper)) {
    const exists = airports.some(
      (airport) => airport.iata_code?.toUpperCase() === upper && airport.scheduled_service === "yes",
    );
    if (exists) return upper;
  }

  return findAirportByNameOrCity(raw);
}

function normalizeVibe(vibe: string | null | undefined) {
  if (!vibe) return null;
  const v = vibe.toLowerCase().trim();
  if (v.includes("beach")) return "beaches";
  if (v.includes("hill") || v.includes("mountain")) return "hills";
  if (v.includes("cozy")) return "cozy";
  if (v.includes("summer")) return "summer vibes";
  return null;
}

/** Keeps the half of the candidates on one side of their midpoint, e.g. the southern half. */
function keepHalf(candidates: Airport[], field: "latitude_deg" | "longitude_deg", keep: (value: number, mid: number) => boolean) {
  const values = candidates.map((a) => parseFloat(a[field])).filter(Number.isFinite);
  if (values.length === 0) return candidates;
  const mid = (Math.min(...values) + Math.max(...values)) / 2;
  return candidates.filter((a) => keep(parseFloat(a[field]), mid));
}

type Resolution = { destination_airport: string | null; explanation: string | null };

type DestinationHints = Pick<
  TripQuery,
  "destination_airport" | "destination_country_code" | "destination_continent_code" | "destination_area" | "vibe_tags"
>;

/**
 * Picks an airport for a search that names a country, continent, region or
 * mood instead of a city, and explains the choice. The pick is random among
 * the airports that fit, so asking again gives another idea.
 */
export function resolveDestination(tripQuery: DestinationHints): Resolution {
  // If destination_airport is already a valid 3-letter IATA code, just return it.
  if (tripQuery.destination_airport && /^[A-Z]{3}$/.test(tripQuery.destination_airport.trim().toUpperCase())) {
    const iata = tripQuery.destination_airport.trim().toUpperCase();
    if (airports.some((a) => a.iata_code === iata)) {
      return { destination_airport: iata, explanation: null };
    }
  }

  // 1. Filter airports by country, continent and area.
  let candidates = airports.filter((a) => a.iata_code && a.scheduled_service === "yes");

  const countryCode = tripQuery.destination_country_code?.trim().toUpperCase();
  const continentCode = tripQuery.destination_continent_code?.trim().toUpperCase();
  const area = tripQuery.destination_area?.toLowerCase().trim();
  const vibeTags = tripQuery.vibe_tags ?? [];

  // Nothing to resolve from.
  if (!countryCode && !continentCode && !area && vibeTags.length === 0) {
    return { destination_airport: null, explanation: null };
  }

  if (countryCode && countryCode !== "EU") {
    candidates = candidates.filter((a) => a.iso_country?.toUpperCase() === countryCode);
  }

  if (continentCode) {
    candidates = candidates.filter((a) => a.continent?.toUpperCase() === continentCode);
  } else if (countryCode === "EU") {
    candidates = candidates.filter((a) => a.continent?.toUpperCase() === "EU");
  }

  const isContinentSearch =
    (continentCode === "EU" || countryCode === "EU") && (!countryCode || countryCode === "EU");

  let appliedArea: string | null = null;
  if (area) {
    if (area.includes("south")) {
      appliedArea = "south";
      // "South of Europe" means the Mediterranean, not the lower half of the map.
      candidates = isContinentSearch
        ? candidates.filter((a) => parseFloat(a.latitude_deg) < 45)
        : keepHalf(candidates, "latitude_deg", (lat, mid) => lat <= mid);
    } else if (area.includes("north")) {
      appliedArea = "north";
      candidates = keepHalf(candidates, "latitude_deg", (lat, mid) => lat > mid);
    } else if (area.includes("east")) {
      appliedArea = "east";
      candidates = keepHalf(candidates, "longitude_deg", (lon, mid) => lon > mid);
    } else if (area.includes("west")) {
      appliedArea = "west";
      candidates = keepHalf(candidates, "longitude_deg", (lon, mid) => lon <= mid);
    }
  }

  // 2. Prefer airports known for the mood the visitor asked for.
  let vibeAirports: string[] = [];
  let matchedVibeName: string | null = null;
  for (const tag of vibeTags) {
    const normalized = normalizeVibe(tag);
    if (normalized && VIBE_AIRPORTS[normalized]) {
      vibeAirports = vibeAirports.concat(VIBE_AIRPORTS[normalized]);
      matchedVibeName = normalized;
    }
  }

  if (vibeAirports.length > 0) {
    const intersected = candidates.filter((a) => vibeAirports.includes(a.iata_code));
    if (intersected.length > 0) candidates = intersected;
  }

  // Only large airports if there are any, then medium ones, so the pick is a viable destination.
  let viableCandidates = candidates.filter((a) => a.type === "large_airport");
  if (viableCandidates.length === 0) viableCandidates = candidates.filter((a) => a.type === "medium_airport");
  if (viableCandidates.length === 0) viableCandidates = candidates;

  if (viableCandidates.length === 0) {
    return { destination_airport: null, explanation: null };
  }

  const selectedAirport = viableCandidates[Math.floor(Math.random() * viableCandidates.length)];
  const destIata = selectedAirport.iata_code;
  const cityName = selectedAirport.municipality || selectedAirport.name;
  const destCountryName = COUNTRY_NAMES[selectedAirport.iso_country] || selectedAirport.iso_country;

  let explanation: string;
  if (matchedVibeName) {
    explanation =
      countryCode || continentCode || area
        ? `Since you want a **${matchedVibeName}** vibe, I selected **${cityName} (${destIata})** in ${destCountryName} for you!`
        : `For a **${matchedVibeName}** getaway, I selected **${cityName} (${destIata})** in ${destCountryName}!`;
  } else if (area) {
    explanation = `Searching in the **${appliedArea}** region of ${isContinentSearch ? "Europe" : destCountryName}, I selected **${cityName} (${destIata})** for you.`;
  } else if (countryCode) {
    explanation = `Since you want to fly to **${destCountryName}**, I selected **${cityName} (${destIata})** for your search.`;
  } else if (continentCode === "EU") {
    explanation = `Looking for flights to **Europe**, I selected **${cityName} (${destIata})** for you.`;
  } else {
    explanation = `Selected **${cityName} (${destIata})** for your flight search.`;
  }

  return { destination_airport: destIata, explanation };
}
