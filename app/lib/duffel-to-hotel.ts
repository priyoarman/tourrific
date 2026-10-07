import type { Hotel } from "./types";
import type { DuffelStaysAccommodation, DuffelStaysResult } from "./types/duffel-stays";

/** Shown in place of a photo when a hotel has none. */
export const HOTEL_GRADIENTS = [
  "from-[#f6c79b] to-[#d9776b]",
  "from-[#a8c8f0] to-[#5f7fd1]",
  "from-[#c7b2f5] to-[#8b6ad8]",
  "from-[#9fdcc7] to-[#3f9a86]",
  "from-[#f3b6c8] to-[#c46a8e]",
  "from-[#f2dfa0] to-[#c99a45]",
];

// The amenities worth one of the three places on a card, most wanted first.
// Anything else is named by Duffel's own description.
const AMENITY_LABELS: Record<string, string> = {
  wifi: "Wi-Fi",
  pool: "Pool",
  spa: "Spa",
  gym: "Gym",
  parking: "Parking",
  restaurant: "Restaurant",
  room_service: "Room service",
  pet_friendly: "Pets welcome",
};
const AMENITIES_SHOWN = 3;

export type Coordinates = { latitude: number; longitude: number };

/** Kilometres between two points, as the crow flies. */
export function distanceKm(a: Coordinates, b: Coordinates) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** Nights between two dates written as YYYY-MM-DD. At least 1. */
function nightsBetween(checkIn: string, checkOut: string) {
  return Math.max(Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / 86_400_000), 1);
}

function amenityLabels(accommodation: DuffelStaysAccommodation) {
  const offered = accommodation.amenities ?? [];
  const known = Object.keys(AMENITY_LABELS)
    .filter((type) => offered.some((amenity) => amenity.type === type))
    .map((type) => AMENITY_LABELS[type]);
  const others = offered.filter((amenity) => !AMENITY_LABELS[amenity.type]).map((amenity) => amenity.description);
  return [...new Set([...known, ...others])].filter(Boolean).slice(0, AMENITIES_SHOWN);
}

/** True when a rate gives all the money back if cancelled early enough. */
function hasFreeCancellation(accommodation: DuffelStaysAccommodation) {
  return (accommodation.rooms ?? []).some((room) =>
    (room.rates ?? []).some((rate) =>
      (rate.cancellation_timeline ?? []).some(
        (step) => Number.parseFloat(step.refund_amount) >= Number.parseFloat(rate.total_amount),
      ),
    ),
  );
}

/** The same hotel always gets the same gradient. */
function gradientFor(id: string) {
  let sum = 0;
  for (const character of id) sum += character.charCodeAt(0);
  return HOTEL_GRADIENTS[sum % HOTEL_GRADIENTS.length];
}

/**
 * Converts one Duffel stays result into the shape the hotel cards render.
 * `centre` is the point the search was made around; distances are measured from it.
 */
export function toHotel(result: DuffelStaysResult, centre?: Coordinates | null): Hotel {
  const { accommodation } = result;
  const address = accommodation.location.address;
  const position = accommodation.location.geographic_coordinates;
  const total = Number.parseFloat(result.cheapest_rate_total_amount);
  const nights = nightsBetween(result.check_in_date, result.check_out_date);

  return {
    id: accommodation.id,
    name: accommodation.name,
    area: address?.line_one || address?.city_name || "",
    distanceKm: centre && position ? Math.round(distanceKm(centre, position) * 10) / 10 : null,
    stars: accommodation.rating ?? null,
    rating: accommodation.review_score ?? null,
    reviewCount: accommodation.review_count ?? null,
    // Duffel prices the whole stay; the cards show a night.
    nightlyPrice: Math.round((total / nights) * 100) / 100,
    currency: result.cheapest_rate_currency,
    amenities: amenityLabels(accommodation),
    photoUrl: accommodation.photos?.[0]?.url ?? null,
    gradient: gradientFor(accommodation.id),
    freeCancellation: hasFreeCancellation(accommodation),
  };
}
