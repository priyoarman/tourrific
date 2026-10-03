// A full Duffel offer is about 14 KB, and a busy route returns thousands of
// them. This keeps only the fields the flight cards read (about 2.6 KB each),
// so a client can ask for every offer in a single response.

function pick(source, keys) {
  const result = {};
  for (const key of keys) {
    if (source?.[key] !== undefined) result[key] = source[key];
  }
  return result;
}

const compactPlace = (place) =>
  pick(place, ["iata_code", "city_name", "iata_country_code"]);

function compactSegment(segment) {
  return {
    ...pick(segment, [
      "departing_at",
      "arriving_at",
      "duration",
      "marketing_carrier_flight_number",
    ]),
    origin: compactPlace(segment.origin),
    destination: compactPlace(segment.destination),
    marketing_carrier: pick(segment.marketing_carrier, ["iata_code", "name"]),
    // Cabin and baggage are the same for every passenger in an offer.
    passengers: (segment.passengers ?? [])
      .slice(0, 1)
      .map((p) => pick(p, ["cabin_class_marketing_name", "baggages"])),
  };
}

function compactSlice(slice) {
  return {
    ...pick(slice, ["duration", "fare_brand_name"]),
    origin: compactPlace(slice.origin),
    destination: compactPlace(slice.destination),
    segments: (slice.segments ?? []).map(compactSegment),
  };
}

export function compactOffer(offer) {
  return {
    ...pick(offer, ["id", "total_amount", "total_currency", "expires_at"]),
    owner: pick(offer.owner, ["iata_code", "name", "logo_symbol_url"]),
    slices: (offer.slices ?? []).map(compactSlice),
  };
}
