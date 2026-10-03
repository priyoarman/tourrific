// Guesses the departure airport from the visitor's IP address when their
// message doesn't name one. Ported from api/src/utils/originFallback.js.
import geoip from "geoip-lite";
import { AIRPORT_TYPE_PRIORITY, airports, type Airport } from "./airports.ts";

const DEFAULT_ORIGIN = "CPH";

const COUNTRY_TO_IATA: Record<string, string> = {
  DK: "CPH",
  GB: "LHR",
  UK: "LHR",
  US: "JFK",
  FR: "CDG",
  ES: "MAD",
  DE: "FRA",
  IT: "FCO",
  NL: "AMS",
  SE: "ARN",
  NO: "OSL",
  FI: "HEL",
  BE: "BRU",
  AT: "VIE",
  CH: "ZRH",
  IE: "DUB",
  PT: "LIS",
};

function normalizeLocationName(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function parseCoordinate(value: string) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : null;
}

function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

type Coordinate = number | null | undefined;

/** The largest airport among the candidates; the nearest one breaks ties. */
function pickBestAirport(candidates: Airport[], latitude: Coordinate, longitude: Coordinate) {
  const ranked = [...candidates].sort((a, b) => {
    const typeDiff = (AIRPORT_TYPE_PRIORITY[a.type] ?? 9) - (AIRPORT_TYPE_PRIORITY[b.type] ?? 9);
    if (typeDiff !== 0) return typeDiff;

    if (latitude != null && longitude != null) {
      const aLat = parseCoordinate(a.latitude_deg);
      const aLon = parseCoordinate(a.longitude_deg);
      const bLat = parseCoordinate(b.latitude_deg);
      const bLon = parseCoordinate(b.longitude_deg);
      if (aLat != null && aLon != null && bLat != null && bLon != null) {
        return distanceKm(latitude, longitude, aLat, aLon) - distanceKm(latitude, longitude, bLat, bLon);
      }
    }

    return 0;
  });

  return ranked[0]?.iata_code?.toUpperCase() || null;
}

function scheduledAirportsInCountry(countryCode: string | undefined) {
  const iso = countryCode?.toUpperCase();
  if (!iso) return [];

  return airports.filter(
    (airport) =>
      airport.iso_country?.toUpperCase() === iso &&
      airport.iata_code &&
      airport.scheduled_service === "yes",
  );
}

function findAirportByCity(city: string | undefined, countryCode: string | undefined, latitude: Coordinate, longitude: Coordinate) {
  const normalizedCity = normalizeLocationName(city);
  if (!normalizedCity) return null;

  const cityMatches = scheduledAirportsInCountry(countryCode).filter((airport) => {
    const municipality = normalizeLocationName(airport.municipality);
    const name = normalizeLocationName(airport.name);
    return (
      municipality === normalizedCity ||
      municipality.includes(normalizedCity) ||
      normalizedCity.includes(municipality) ||
      name.includes(normalizedCity)
    );
  });

  return cityMatches.length > 0 ? pickBestAirport(cityMatches, latitude, longitude) : null;
}

function findAirportByCountry(countryCode: string | undefined, latitude: Coordinate, longitude: Coordinate) {
  const iso = countryCode?.toUpperCase();
  if (!iso) return null;
  if (COUNTRY_TO_IATA[iso]) return COUNTRY_TO_IATA[iso];

  return pickBestAirport(scheduledAirportsInCountry(iso), latitude, longitude);
}

function sanitizeIp(ip: string | null | undefined) {
  if (!ip) return null;

  let value = ip.trim();
  if (value.startsWith("::ffff:")) value = value.slice(7);
  if (!value || value === "::1" || value === "127.0.0.1") return null;

  return value;
}

/**
 * The visitor's IP address, or null when running locally.
 *
 * A host's proxy puts the address in `x-forwarded-for` as "client, proxy1,
 * proxy2", so the first entry is the visitor. This replaces the request-ip
 * package the Express backend used.
 */
export function clientIp(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0];
  return sanitizeIp(forwarded) ?? sanitizeIp(headers.get("x-real-ip"));
}

export function detectOriginFromIp(headers: Headers) {
  try {
    const ip = clientIp(headers);
    if (!ip) return null;

    const geo = geoip.lookup(ip);
    if (!geo) return null;

    const [latitude, longitude] = geo.ll || [];
    const country = geo.country?.toUpperCase();

    return (
      findAirportByCity(geo.city, country, latitude, longitude) ??
      findAirportByCountry(country, latitude, longitude)
    );
  } catch {
    return null;
  }
}

/** The airport to fly from when the visitor didn't say: the one nearest their IP, else Copenhagen. */
export function detectFallbackOrigin(headers: Headers) {
  return detectOriginFromIp(headers) ?? DEFAULT_ORIGIN;
}
