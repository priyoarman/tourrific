// Turns how long the visitor said they stay into the day they fly back.
import { addDays } from "../destinations.ts";
import type { StayUnit } from "../types/trip-query";

/**
 * The day a stay of `length` `unit`s that starts on `departure` (YYYY-MM-DD) ends.
 * Days count the day of departure and the day home: a seven-day plan flies
 * out on day 1 and back on day 7, six nights later. A week is seven nights.
 */
export function returnDateFor(departure: string, length: number, unit: StayUnit) {
  const nights = unit === "nights" ? length : unit === "weeks" ? length * 7 : length - 1;
  return addDays(departure, nights);
}
