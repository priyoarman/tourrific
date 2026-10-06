// How often one address may sign up or log in. Signing up is limited so that
// new accounts can't be created to get around the search limits, and logging
// in so that passwords can't be guessed quickly.
import { ipKey, limitFromEnv, type RateLimitRule } from "./rate-limit.ts";

const MINUTE = 60 * 1000;

/** Every sign-up attempt that gets as far as the database counts, whether or not it creates an account. */
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

/** Every login attempt counts, right or wrong. */
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
