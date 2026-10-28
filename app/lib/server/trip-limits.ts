// How many trips a visitor may store. Guests can write to the database too, so
// this keeps one visitor from filling the trips table. Picking a trip follows a
// search, which has its own daily limit, so this is set well above that.
import { ipKey, limitFromEnv, type RateLimitRule } from "./rate-limit.ts";

const DAY = 24 * 60 * 60 * 1000;

/** Guests are counted by IP address, a logged-in user by account. */
export function tripLimitRules(user: { userId: bigint } | null, headers: Headers): RateLimitRule[] {
  return [
    {
      name: "trips",
      key: user ? `user:${user.userId}` : ipKey(headers),
      limit: limitFromEnv("TRIP_LIMIT_PER_DAY", 50),
      windowMs: DAY,
    },
  ];
}
