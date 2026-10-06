// Counts requests per visitor so the endpoints that spend Groq and Duffel quota
// can turn away a flood. The counts live in this process's memory, which is
// right for a single instance; several instances would need a shared store
// (Redis) behind the same RateLimiter interface.
import { clientIp } from "./origin-fallback.ts";

/** At most `limit` requests per `windowMs` for whoever `key` identifies. */
export type RateLimitRule = {
  /** Which limit this is, e.g. "burst". Reported back when it blocks. */
  name: string;
  /** Who is being counted, e.g. "ip:203.0.113.7", "user:42" or "global". */
  key: string;
  limit: number;
  windowMs: number;
};

export type RateLimitVerdict =
  | { allowed: true }
  | {
      allowed: false;
      /** The `name` of the rule that blocked the request. */
      rule: string;
      /** Whole seconds until that rule has room again. */
      retryAfterSeconds: number;
    };

export interface RateLimiter {
  /**
   * Counts one request against every rule, or against none: when any rule is
   * full the request is blocked and nothing is counted. Rules are checked in
   * order and the first full one is reported.
   */
  consume(rules: RateLimitRule[]): Promise<RateLimitVerdict>;
}

type Entry = {
  /** When each counted request arrived, oldest first. */
  hits: number[];
  windowMs: number;
};

type MemoryOptions = {
  /** The clock, in milliseconds. Tests pass their own. */
  now?: () => number;
  /** The most visitors remembered at once; the least recently seen are forgotten first. */
  maxKeys?: number;
  /** How often entries nobody has touched are cleared out. */
  sweepEveryMs?: number;
};

/**
 * A sliding-window limiter: a request is allowed when fewer than `limit` were
 * counted in the `windowMs` before it, so there is no moment (as with fixed
 * windows) where a visitor gets twice the limit.
 */
export function createMemoryRateLimiter({
  now = Date.now,
  maxKeys = 10_000,
  sweepEveryMs = 60_000,
}: MemoryOptions = {}): RateLimiter & { size(): number } {
  // A Map keeps insertion order, so the first key is the least recently used.
  const entries = new Map<string, Entry>();
  let lastSweep = now();

  /** The hits still inside the rule's window, with expired ones dropped. */
  function recentHits(id: string, rule: RateLimitRule, time: number) {
    const entry = entries.get(id);
    if (!entry) return [];

    const cutoff = time - rule.windowMs;
    const firstRecent = entry.hits.findIndex((hit) => hit > cutoff);
    if (firstRecent === -1) return [];
    return firstRecent === 0 ? entry.hits : entry.hits.slice(firstRecent);
  }

  function sweep(time: number) {
    lastSweep = time;
    for (const [id, entry] of entries) {
      const newest = entry.hits[entry.hits.length - 1];
      if (newest === undefined || newest <= time - entry.windowMs) entries.delete(id);
    }
  }

  return {
    async consume(rules) {
      const time = now();
      if (time - lastSweep >= sweepEveryMs) sweep(time);

      // Two rules may share a key (a burst and a daily limit per IP), so each is counted under its name.
      const counted = rules.map((rule) => {
        const id = `${rule.name}:${rule.key}`;
        return { id, rule, hits: recentHits(id, rule, time) };
      });

      const full = counted.find(({ rule, hits }) => hits.length >= rule.limit);
      if (full) {
        // Room opens when the oldest counted request leaves the window.
        const oldest = full.hits[0] ?? time;
        const waitMs = oldest + full.rule.windowMs - time;
        return { allowed: false, rule: full.rule.name, retryAfterSeconds: Math.max(Math.ceil(waitMs / 1000), 1) };
      }

      for (const { id, rule, hits } of counted) {
        // Deleted and set again, so the key moves to the recently-used end.
        entries.delete(id);
        entries.set(id, { hits: [...hits, time], windowMs: rule.windowMs });
      }

      // A flood of made-up addresses must not grow the map without end.
      for (const id of entries.keys()) {
        if (entries.size <= maxKeys) break;
        entries.delete(id);
      }

      return { allowed: true };
    },

    size: () => entries.size,
  };
}

// Kept on `globalThis` so every route counts in the same place: Next.js may
// load this module once per route, and reloads it on every change in development.
const globalForRateLimit = globalThis as unknown as { rateLimiter?: RateLimiter };

/** The limiter the API routes share. */
export const rateLimiter: RateLimiter = (globalForRateLimit.rateLimiter ??= createMemoryRateLimiter());

/**
 * The key a visitor is counted under when they aren't logged in. Requests with
 * no usable address (local development) all share one key.
 */
export function ipKey(headers: Headers) {
  return `ip:${clientIp(headers) ?? "unknown"}`;
}
