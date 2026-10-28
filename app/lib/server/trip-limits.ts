import { ipKey, limitFromEnv, type RateLimitRule } from "./rate-limit.ts";

const DAY = 24 * 60 * 60 * 1000;

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
