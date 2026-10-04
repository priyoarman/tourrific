// Dates and times are read as written and never converted between time zones,
// so server and client render identical text.

export function formatTime(iso: string) {
  return iso.slice(11, 16);
}

/** Accepts a date ("2026-11-12") or a date-time; only the date part is used. */
export function formatDate(iso: string) {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** "$1,234" for whole amounts, "€96.85" otherwise. `currency` is an ISO 4217 code. */
export function formatPrice(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Number of calendar days between departure and arrival, e.g. 1 for "+1". */
export function dayOffset(departureIso: string, arrivalIso: string) {
  const day = (iso: string) => Date.parse(iso.slice(0, 10));
  return Math.round((day(arrivalIso) - day(departureIso)) / 86_400_000);
}

export function formatNights(nights: number) {
  return nights === 1 ? "1 night" : `${nights} nights`;
}
