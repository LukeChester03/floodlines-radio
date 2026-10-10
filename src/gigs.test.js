import test from "node:test";
import assert from "node:assert/strict";
import { gigId, gigView, runSummary } from "./gigs.js";

const now = new Date("2026-10-10T12:00:00Z").getTime();
const g = (id, date, score) => ({ id, date, score });

test("gigView hides past gigs, keeps undated, orders by score then soonest date", () => {
  const out = gigView([g("past", "2026-10-09", 99), g("lo", "2026-11-01", 1), g("undated", null, 5), g("hiLate", "2026-12-01", 5), g("hiSoon", "2026-10-20", 5), g("today", "2026-10-10", 0)], { now });
  assert.deepEqual(out.map(x => x.id), ["hiSoon", "hiLate", "undated", "lo", "today"]);
});

test("runSummary", () => {
  assert.equal(runSummary({ ranAt: now - 3 * 864e5, errors: ["a", "b"] }, now), "Last searched 3 days ago · 2 problems");
  assert.equal(runSummary(null, now), "Not searched yet");
});

test("gigId ignores host case, trailing slash, utm_* and fbclid", () => {
  assert.equal(gigId("https://Ex.com/a/?utm_source=x&fbclid=1&id=2"), gigId("https://ex.com/a?id=2"));
  assert.notEqual(gigId("https://ex.com/a"), gigId("https://ex.com/b"));
});
