import assert from "node:assert/strict";
import { test } from "node:test";
import { loginLimitRules, signupLimitRules } from "./auth-limits.ts";
import { createMemoryRateLimiter, ipKey, type RateLimitRule } from "./rate-limit.ts";
import { searchLimitRules } from "./search-limits.ts";

const SECOND = 1000;
const MINUTE = 60 * SECOND;

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

  assert.deepEqual(await limiter.consume([burst("ip:a")]), { allowed: false, rule: "burst", retryAfterSeconds: 30 });

  advance(29 * SECOND);
  assert.deepEqual(await limiter.consume([burst("ip:a")]), { allowed: false, rule: "burst", retryAfterSeconds: 1 });

  advance(1 * SECOND);
  assert.deepEqual(await limiter.consume([burst("ip:a")]), { allowed: true });
  assert.deepEqual(await limiter.consume([burst("ip:a")]), { allowed: false, rule: "burst", retryAfterSeconds: 10 });
});

test("the window slides, so a visitor never gets twice the limit around a boundary", async () => {
  const { limiter, advance } = limiterAt();

  advance(59 * SECOND);
  for (let i = 0; i < 3; i++) assert.equal((await limiter.consume([burst("ip:a")])).allowed, true);

  advance(2 * SECOND);
  assert.equal((await limiter.consume([burst("ip:a")])).allowed, false);
});

test("counts each visitor and each rule separately", async () => {
  const { limiter } = limiterAt();
  const daily = (key: string): RateLimitRule => ({ name: "guest_limit", key, limit: 5, windowMs: 24 * 60 * MINUTE });

  for (let i = 0; i < 3; i++) await limiter.consume([burst("ip:a"), daily("ip:a")]);

  assert.equal((await limiter.consume([burst("ip:a")])).allowed, false);
  assert.equal((await limiter.consume([burst("ip:b")])).allowed, true);
  assert.equal((await limiter.consume([daily("ip:a")])).allowed, true);
});

test("a blocked request counts against none of its rules", async () => {
  const { limiter, advance } = limiterAt();
  const global: RateLimitRule = { name: "busy", key: "global", limit: 4, windowMs: MINUTE };

  for (let i = 0; i < 3; i++) await limiter.consume([global, burst("ip:a")]);

  for (let i = 0; i < 20; i++) {
    assert.deepEqual(await limiter.consume([global, burst("ip:a")]), {
      allowed: false,
      rule: "burst",
      retryAfterSeconds: 60,
    });
  }
  assert.equal((await limiter.consume([global, burst("ip:b")])).allowed, true);

  assert.equal((await limiter.consume([global, burst("ip:c")])).allowed, false);
  const verdict = await limiter.consume([global, burst("ip:a")]);
  assert.equal(!verdict.allowed && verdict.rule, "busy");

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

  for (let i = 50; i < 100; i++) await limiter.consume([global, burst(`ip:${i}`, 1)]);
  const verdict = await limiter.consume([global, burst("ip:new", 1)]);
  assert.equal(!verdict.allowed && verdict.rule, "busy");

  assert.equal((await limiter.consume([burst("ip:99", 1)])).allowed, false);
});

test("guests are counted by IP address", () => {
  assert.equal(ipKey(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })), "ip:203.0.113.7");
  assert.equal(ipKey(new Headers({ "x-forwarded-for": "::ffff:203.0.113.7" })), "ip:203.0.113.7");
  assert.equal(ipKey(new Headers()), "ip:unknown");
});

const guest = (ip: string) => searchLimitRules(null, new Headers({ "x-forwarded-for": ip }));
const member = (id: number, ip = "203.0.113.7") =>
  searchLimitRules({ userId: BigInt(id) }, new Headers({ "x-forwarded-for": ip }));

test("a search is cut off after 15 in a minute", async () => {
  const { limiter, advance } = limiterAt();

  for (let i = 0; i < 15; i++) assert.equal((await limiter.consume(member(42))).allowed, true);
  assert.deepEqual(await limiter.consume(member(42)), {
    allowed: false,
    rule: "burst",
    retryAfterSeconds: 60,
  });
  assert.equal((await limiter.consume(member(43))).allowed, true);

  advance(MINUTE);
  assert.equal((await limiter.consume(member(42))).allowed, true);
});

test("answering a question from the planner skips the per-minute limit but not the daily one", async () => {
  const { limiter } = limiterAt();
  const answer = (id: number) =>
    searchLimitRules({ userId: BigInt(id) }, new Headers({ "x-forwarded-for": "203.0.113.7" }), { answering: true });

  for (let i = 0; i < 15; i++) await limiter.consume(member(42));
  assert.equal((await limiter.consume(member(42))).allowed, false);
  for (let i = 0; i < 35; i++) assert.equal((await limiter.consume(answer(42))).allowed, true);
  const blocked = await limiter.consume(answer(42));
  assert.equal(!blocked.allowed && blocked.rule, "user_limit");
});

test("a guest gets 10 searches a day, and logging in gives more", async () => {
  const { limiter, advance } = limiterAt();

  for (let i = 0; i < 10; i++) {
    assert.equal((await limiter.consume(guest("203.0.113.7"))).allowed, true);
    advance(MINUTE);
  }
  const blocked = await limiter.consume(guest("203.0.113.7"));
  assert.deepEqual(blocked, { allowed: false, rule: "guest_limit", retryAfterSeconds: 24 * 60 * 60 - 10 * 60 });

  for (let i = 0; i < 50; i++) {
    assert.equal((await limiter.consume(member(42))).allowed, true);
    advance(MINUTE);
  }
  const memberBlocked = await limiter.consume(member(42));
  assert.equal(!memberBlocked.allowed && memberBlocked.rule, "user_limit");

  assert.equal((await limiter.consume(member(42, "198.51.100.4"))).allowed, false);
  assert.equal((await limiter.consume(member(43))).allowed, true);
});

test("everyone's searches together are capped, and the limits can be set in the environment", async () => {
  const { limiter } = limiterAt();
  process.env.SEARCH_LIMIT_GLOBAL_PER_DAY = "3";
  process.env.SEARCH_LIMIT_PER_MINUTE = "not a number";

  try {
    for (let i = 0; i < 3; i++) assert.equal((await limiter.consume(guest(`203.0.113.${i}`))).allowed, true);
    const blocked = await limiter.consume(guest("203.0.113.9"));
    assert.equal(!blocked.allowed && blocked.rule, "busy");
    assert.equal(guest("203.0.113.9")[1].limit, 15);
  } finally {
    delete process.env.SEARCH_LIMIT_GLOBAL_PER_DAY;
    delete process.env.SEARCH_LIMIT_PER_MINUTE;
  }
});

test("one address gets 10 login attempts in 15 minutes and 5 sign-ups a day", async () => {
  const { limiter, advance } = limiterAt();
  const from = (ip: string) => new Headers({ "x-forwarded-for": ip });

  for (let i = 0; i < 10; i++) assert.equal((await limiter.consume(loginLimitRules(from("203.0.113.7")))).allowed, true);
  assert.deepEqual(await limiter.consume(loginLimitRules(from("203.0.113.7"))), {
    allowed: false,
    rule: "login",
    retryAfterSeconds: 15 * 60,
  });
  assert.equal((await limiter.consume(loginLimitRules(from("198.51.100.4")))).allowed, true);

  for (let i = 0; i < 5; i++) assert.equal((await limiter.consume(signupLimitRules(from("203.0.113.7")))).allowed, true);
  const blocked = await limiter.consume(signupLimitRules(from("203.0.113.7")));
  assert.equal(!blocked.allowed && blocked.rule, "signup");

  advance(15 * MINUTE);
  assert.equal((await limiter.consume(loginLimitRules(from("203.0.113.7")))).allowed, true);
  assert.equal((await limiter.consume(signupLimitRules(from("203.0.113.7")))).allowed, false);
});
