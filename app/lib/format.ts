export function formatTime(iso: string) {
  return iso.slice(11, 16);
}

export function formatDate(iso: string) {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

const MONTH = { month: "short", timeZone: "UTC" } as const;
const parts = (iso: string) => {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return {
    day: date.getUTCDate(),
    month: date.toLocaleDateString("en-GB", MONTH),
    year: date.getUTCFullYear(),
  };
};

export function formatDateRange(start: string, end: string) {
  const a = parts(start);
  const b = parts(end);
  if (a.year !== b.year) return `${a.day} ${a.month} ${a.year} – ${b.day} ${b.month} ${b.year}`;
  if (a.month !== b.month) return `${a.day} ${a.month} – ${b.day} ${b.month} ${b.year}`;
  return `${a.day} – ${b.day} ${b.month} ${b.year}`;
}

export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function formatPrice(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function dayOffset(departureIso: string, arrivalIso: string) {
  const day = (iso: string) => Date.parse(iso.slice(0, 10));
  return Math.round((day(arrivalIso) - day(departureIso)) / 86_400_000);
}

export function formatNights(nights: number) {
  return nights === 1 ? "1 night" : `${nights} nights`;
}
