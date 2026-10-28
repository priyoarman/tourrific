import { ipKey, limitFromEnv, type RateLimitRule } from "./rate-limit.ts";

const MINUTE = 60 * 1000;

export function signupLimitRules(headers: Headers): RateLimitRule[] {
  return [
    {
      name: "signup",
      key: ipKey(headers),
      limit: limitFromEnv("AUTH_LIMIT_SIGNUPS_PER_DAY", 5),
      windowMs: 24 * 60 * MINUTE,
    },
  ];
}

export function loginLimitRules(headers: Headers): RateLimitRule[] {
  return [
    {
      name: "login",
      key: ipKey(headers),
      limit: limitFromEnv("AUTH_LIMIT_LOGINS_PER_15_MIN", 10),
      windowMs: 15 * MINUTE,
    },
  ];
}
