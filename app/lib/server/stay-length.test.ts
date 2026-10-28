import assert from "node:assert/strict";
import { test } from "node:test";
import { returnDateFor } from "./stay-length.ts";

const FRIDAY = "2026-11-06";

test("a stay in nights flies back that many days later", () => {
  assert.equal(returnDateFor(FRIDAY, 5, "nights"), "2026-11-11");
  assert.equal(returnDateFor(FRIDAY, 1, "nights"), "2026-11-07");
});

test("a stay in days counts the day out and the day home", () => {
  assert.equal(returnDateFor(FRIDAY, 7, "days"), "2026-11-12");
  assert.equal(returnDateFor("2026-11-07", 2, "days"), "2026-11-08");
  assert.equal(returnDateFor(FRIDAY, 1, "days"), FRIDAY);
});

test("a week is seven nights", () => {
  assert.equal(returnDateFor(FRIDAY, 1, "weeks"), "2026-11-13");
  assert.equal(returnDateFor(FRIDAY, 2, "weeks"), "2026-11-20");
});

test("a stay runs on into the next month and year", () => {
  assert.equal(returnDateFor("2026-12-28", 5, "nights"), "2027-01-02");
  assert.equal(returnDateFor("2028-02-27", 3, "nights"), "2028-03-01");
});
