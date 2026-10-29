import type { SearchLimitReason } from "../types/stream-events";
import { ipKey, limitFromEnv, type RateLimitRule } from "./rate-limit.ts";

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

export function searchLimitRules(
  user: { userId: bigint } | null,
  headers: Headers,
  { answering = false } = {},
): (RateLimitRule & { name: SearchLimitReason })[] {
  const who = user ? `user:${user.userId}` : ipKey(headers);

  return [
    { name: "busy", key: "global", limit: limitFromEnv("SEARCH_LIMIT_GLOBAL_PER_DAY", 500), windowMs: DAY },
    ...(answering
      ? []
      : [{ name: "burst" as const, key: who, limit: limitFromEnv("SEARCH_LIMIT_PER_MINUTE", 15), windowMs: MINUTE }]),
    user
      ? { name: "user_limit", key: who, limit: limitFromEnv("SEARCH_LIMIT_USER_PER_DAY", 50), windowMs: DAY }
      : { name: "guest_limit", key: who, limit: limitFromEnv("SEARCH_LIMIT_GUEST_PER_DAY", 10), windowMs: DAY },
  ];
}

export const SEARCH_LIMIT_MESSAGES: Record<SearchLimitReason, string> = {
  busy: "Tourrific is very busy right now. Please try again later.",
  burst: "You're searching very quickly. Please wait a moment and try again.",
  guest_limit: "You've used your free searches for today. Sign in or sign up to keep going.",
  user_limit: "You've reached today's search limit. Please try again tomorrow.",
};
