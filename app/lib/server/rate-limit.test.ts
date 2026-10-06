// Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createMemoryRateLimiter, ipKey, type RateLimitRule } from "./rate-limit.ts";

const SECOND = 1000;
const MINUTE = 60 * SECOND;

/** A limiter whose clock only moves when the test says so. */
function limiterAt(start = 0, options: { maxKeys?: number } = {}) {
  let time = start;
  const limiter = createMemoryRateLimiter({ now: () => time, ...options });
  return { limiter, advance: (ms: number) => (time += ms) };
}

const burst = (key: string, limit = 3): RateLimitRule => ({ name: "burst", key, limit, windowMs: MINUTE });

test("allows up to the limit, then blocks until the window has room", async () => {
  const { limiter, advance } = limiterAt();

  for (let i = 0; i < 3; i++) {
    assert.deepEqual(await limiter.consume([burst("ip:a")]), { allowed: true });
    advance(10 * SECOND);
  }

  // Hits at 0s, 10s and 20s; it is now 30s, so the first one leaves at 60s.
  assert.deepEqual(await limiter.consume([burst("ip:a")]), { allowed: false, rule: "burst", retryAfterSeconds: 30 });

  advance(29 * SECOND);
  assert.deepEqual(await limiter.consume([burst("ip:a")]), { allowed: false, rule: "burst", retryAfterSeconds: 1 });

  advance(1 * SECOND);
  assert.deepEqual(await limiter.consume([burst("ip:a")]), { allowed: true });
  // Only one slot opened: the hits at 10s and 20s are still in the window.
  assert.deepEqual(await limiter.consume([burst("ip:a")]), { allowed: false, rule: "burst", retryAfterSeconds: 10 });
});

test("the window slides, so a visitor never gets twice the limit around a boundary", async () => {
  const { limiter, advance } = limiterAt();

  advance(59 * SECOND);
  for (let i = 0; i < 3; i++) assert.equal((await limiter.consume([burst("ip:a")])).allowed, true);

  // A fixed one-minute window would start afresh here.
  advance(2 * SECOND);
  assert.equal((await limiter.consume([burst("ip:a")])).allowed, false);
});

test("counts each visitor and each rule separately", async () => {
  const { limiter } = limiterAt();
  const daily = (key: string): RateLimitRule => ({ name: "guest_limit", key, limit: 5, windowMs: 24 * 60 * MINUTE });

  for (let i = 0; i < 3; i++) await limiter.consume([burst("ip:a"), daily("ip:a")]);

  assert.equal((await limiter.consume([burst("ip:a")])).allowed, false);
  assert.equal((await limiter.consume([burst("ip:b")])).allowed, true);
  // Same key, different rule: the daily limit has only seen three.
  assert.equal((await limiter.consume([daily("ip:a")])).allowed, true);
});

test("a blocked request counts against none of its rules", async () => {
  const { limiter, advance } = limiterAt();
  const global: RateLimitRule = { name: "busy", key: "global", limit: 4, windowMs: MINUTE };

  for (let i = 0; i < 3; i++) await limiter.consume([global, burst("ip:a")]);

  // ip:a is over its burst limit; hammering on must not use up the global budget.
  for (let i = 0; i < 20; i++) {
    assert.deepEqual(await limiter.consume([global, burst("ip:a")]), {
      allowed: false,
      rule: "burst",
      retryAfterSeconds: 60,
    });
  }
  assert.equal((await limiter.consume([global, burst("ip:b")])).allowed, true);

  // Now the global budget is spent, and it is reported first because it is checked first.
  assert.equal((await limiter.consume([global, burst("ip:c")])).allowed, false);
  const verdict = await limiter.consume([global, burst("ip:a")]);
  assert.equal(!verdict.allowed && verdict.rule, "busy");

  // Blocked requests don't extend the wait either.
  advance(MINUTE);
  assert.equal((await limiter.consume([global, burst("ip:a")])).allowed, true);
});

test("forgets visitors who have gone quiet", async () => {
  const { limiter, advance } = limiterAt();

  for (const key of ["ip:a", "ip:b", "ip:c"]) await limiter.consume([burst(key)]);
  assert.equal(limiter.size(), 3);

  advance(2 * MINUTE);
  await limiter.consume([burst("ip:d")]);
  assert.equal(limiter.size(), 1);
});

test("remembers a bounded number of visitors, dropping the least recently seen", async () => {
  const { limiter } = limiterAt(0, { maxKeys: 3 });
  const global: RateLimitRule = { name: "busy", key: "global", limit: 100, windowMs: MINUTE };

  for (let i = 0; i < 50; i++) await limiter.consume([global, burst(`ip:${i}`, 1)]);
  assert.equal(limiter.size(), 3);

  // The global count is touched by every request, so it survives the flood.
  for (let i = 50; i < 100; i++) await limiter.consume([global, burst(`ip:${i}`, 1)]);
  const verdict = await limiter.consume([global, burst("ip:new", 1)]);
  assert.equal(!verdict.allowed && verdict.rule, "busy");

  // So does the most recent visitor.
  assert.equal((await limiter.consume([burst("ip:99", 1)])).allowed, false);
});

test("guests are counted by IP address", () => {
  assert.equal(ipKey(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })), "ip:203.0.113.7");
  assert.equal(ipKey(new Headers({ "x-forwarded-for": "::ffff:203.0.113.7" })), "ip:203.0.113.7");
  assert.equal(ipKey(new Headers()), "ip:unknown");
});
