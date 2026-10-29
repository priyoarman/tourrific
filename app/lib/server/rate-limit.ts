import { clientIp } from "./origin-fallback.ts";

export type RateLimitRule = {
  name: string;
  key: string;
  limit: number;
  windowMs: number;
};

export type RateLimitVerdict =
  | { allowed: true }
  | {
      allowed: false;
      rule: string;
      retryAfterSeconds: number;
    };

export interface RateLimiter {
  consume(rules: RateLimitRule[]): Promise<RateLimitVerdict>;
  refund(rules: RateLimitRule[]): Promise<void>;
}

type Entry = {
  hits: number[];
  windowMs: number;
};

type MemoryOptions = {
  now?: () => number;
  maxKeys?: number;
  sweepEveryMs?: number;
};

export function createMemoryRateLimiter({
  now = Date.now,
  maxKeys = 10_000,
  sweepEveryMs = 60_000,
}: MemoryOptions = {}): RateLimiter & { size(): number } {
  const entries = new Map<string, Entry>();
  let lastSweep = now();

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

      const counted = rules.map((rule) => {
        const id = `${rule.name}:${rule.key}`;
        return { id, rule, hits: recentHits(id, rule, time) };
      });

      const full = counted.find(({ rule, hits }) => hits.length >= rule.limit);
      if (full) {
        const oldest = full.hits[0] ?? time;
        const waitMs = oldest + full.rule.windowMs - time;
        return { allowed: false, rule: full.rule.name, retryAfterSeconds: Math.max(Math.ceil(waitMs / 1000), 1) };
      }

      for (const { id, rule, hits } of counted) {
        entries.delete(id);
        entries.set(id, { hits: [...hits, time], windowMs: rule.windowMs });
      }

      for (const id of entries.keys()) {
        if (entries.size <= maxKeys) break;
        entries.delete(id);
      }

      return { allowed: true };
    },

    async refund(rules) {
      for (const rule of rules) {
        const entry = entries.get(`${rule.name}:${rule.key}`);
        entry?.hits.pop();
      }
    },

    size: () => entries.size,
  };
}

const globalForRateLimit = globalThis as unknown as { rateLimiter?: RateLimiter };

export const rateLimiter: RateLimiter = (globalForRateLimit.rateLimiter ??= createMemoryRateLimiter());

export function ipKey(headers: Headers) {
  return `ip:${clientIp(headers) ?? "unknown"}`;
}

export function limitFromEnv(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return value > 0 ? value : fallback;
}
