// All dates are handled in UTC so server and client render identical text.

export function formatTime(iso: string) {
  return iso.slice(11, 16);
}

export function formatDate(iso: string) {
  return new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso).toLocaleDateString(
    "en-GB",
    { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" },
  );
}

export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function formatPrice(amount: number) {
  return `$${amount.toLocaleString("en-US")}`;
}

/** Number of calendar days between departure and arrival, e.g. 1 for "+1". */
export function dayOffset(departureIso: string, arrivalIso: string) {
  const day = (iso: string) => Date.parse(iso.slice(0, 10));
  return Math.round((day(arrivalIso) - day(departureIso)) / 86_400_000);
}

export function formatNights(nights: number) {
  return nights === 1 ? "1 night" : `${nights} nights`;
}
