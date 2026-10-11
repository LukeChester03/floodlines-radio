import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_GIG_AREAS, DEFAULT_GIG_PHRASES, gigDecisionPatch, gigId, gigSettings, gigView, parseList, runSummary } from "./gigs.js";

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

test("gigDecisionPatch stamps the decision and rejects unknown ones", () => {
  const at = new Date("2026-10-10T12:00:00Z");
  assert.deepEqual(gigDecisionPatch("applied", at), { decision: "applied", decidedAt: at.toISOString() });
  assert.throws(() => gigDecisionPatch("spam", at));
});

test("gigView filters by decision, new meaning undecided", () => {
  const gs = [{ id: "a", decision: "interested" }, { id: "b" }, { id: "c", decision: "passed" }];
  assert.deepEqual(gigView(gs, { now, decision: "new" }).map(x => x.id), ["b"]);
  assert.deepEqual(gigView(gs, { now, decision: "interested" }).map(x => x.id), ["a"]);
  assert.equal(gigView(gs, { now, decision: "all" }).length, 3);
});

test("gigView filters by month", () => {
  const gs = [g("nov", "2026-11-05", 1), g("dec", "2026-12-05", 1), g("none", null, 1)];
  assert.deepEqual(gigView(gs, { now, month: "2026-11" }).map(x => x.id), ["nov"]);
});

test("parseList trims, drops blanks, de-dupes case-insensitively keeping the first", () => {
  assert.deepEqual(parseList("Brighton\n brighton \n\nHove"), ["Brighton", "Hove"]);
});

test("gigSettings applies defaults for unset or empty lists", () => {
  assert.deepEqual(gigSettings({}), { areas: DEFAULT_GIG_AREAS, similarArtists: [], phrases: DEFAULT_GIG_PHRASES });
  assert.deepEqual(gigSettings({ gigAreas: ["Bristol"], gigPhrases: [] }), { areas: ["Bristol"], similarArtists: [], phrases: DEFAULT_GIG_PHRASES });
});
