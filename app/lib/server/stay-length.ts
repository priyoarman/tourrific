import { addDays } from "../destinations.ts";
import type { StayUnit } from "../types/trip-query";

export function returnDateFor(departure: string, length: number, unit: StayUnit) {
  const nights = unit === "nights" ? length : unit === "weeks" ? length * 7 : length - 1;
  return addDays(departure, nights);
}
