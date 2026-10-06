// How many searches a visitor gets. Every chat message counts, since each one
// costs a Groq call whether or not it goes on to search Duffel.
import type { SearchLimitReason } from "../types/stream-events";
import { ipKey, limitFromEnv, type RateLimitRule } from "./rate-limit.ts";

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

/**
 * The limits one search has to pass, in the order they are checked: the
 * budget shared by everyone, then how fast this visitor is going, then their
 * allowance for the day. Guests are counted by IP address; a logged-in user is
 * counted by account and gets a larger allowance.
 */
export function searchLimitRules(
  user: { userId: bigint } | null,
  headers: Headers,
): (RateLimitRule & { name: SearchLimitReason })[] {
  // Read per call, so a changed .env.local is picked up without a restart.
  const who = user ? `user:${user.userId}` : ipKey(headers);

  return [
    { name: "busy", key: "global", limit: limitFromEnv("SEARCH_LIMIT_GLOBAL_PER_DAY", 500), windowMs: DAY },
    { name: "burst", key: who, limit: limitFromEnv("SEARCH_LIMIT_PER_MINUTE", 5), windowMs: MINUTE },
    user
      ? { name: "user_limit", key: who, limit: limitFromEnv("SEARCH_LIMIT_USER_PER_DAY", 50), windowMs: DAY }
      : { name: "guest_limit", key: who, limit: limitFromEnv("SEARCH_LIMIT_GUEST_PER_DAY", 10), windowMs: DAY },
  ];
}

/** What the visitor is told when a limit turns their search away. */
export const SEARCH_LIMIT_MESSAGES: Record<SearchLimitReason, string> = {
  busy: "Tourrific is very busy right now. Please try again later.",
  burst: "You're searching very quickly. Please wait a moment and try again.",
  guest_limit: "You've used your free searches for today. Log in or sign up to keep going.",
  user_limit: "You've reached today's search limit. Please try again tomorrow.",
};
