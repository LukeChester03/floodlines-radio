import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_GIG_AREAS, DEFAULT_GIG_PHRASES, gigDecisionPatch, gigId, gigSettings, gigStub, gigView, parseList, runSummary } from "./gigs.js";

const now = new Date("2026-10-10T12:00:00Z").getTime();
const g = (id, date, score) => ({ id, date, score });

test("gigView hides past gigs, keeps undated, orders by score then soonest date", () => {
  const out = gigView([g("past", "2026-10-09", 99), g("lo", "2026-11-01", 1), g("undated", null, 5), g("hiLate", "2026-12-01", 5), g("hiSoon", "2026-10-20", 5), g("today", "2026-10-10", 0)], { now });
  assert.deepEqual(out.map(x => x.id), ["hiSoon", "hiLate", "undated", "lo", "today"]);
});

// UK clock times; 25 Oct 2026 is when BST ends, so these late-October dates are GMT (= UTC)
const at = s => new Date(s).getTime();
const ran = s => ({ ranAt: new Date(s).toISOString(), errors: [] });

test("runSummary with no status: never searched, nothing missed, next Monday", () => {
  assert.deepEqual(runSummary(null, at("2026-10-29T12:00:00Z")), { last: null, next: "Next search Mon 2 Nov, 7am", missed: false, found: null, problems: [] });
});

test("runSummary after Monday's run says when it last ran and when it runs next", () => {
  const s = runSummary(ran("2026-10-26T07:05:00Z"), at("2026-10-29T12:00:00Z"));
  assert.equal(s.last, "Last search Mon 26 Oct");
  assert.equal(s.missed, false);
  assert.equal(s.next, "Next search Mon 2 Nov, 7am");
});

test("runSummary next search is strictly after now", () => {
  assert.equal(runSummary(null, at("2026-11-02T07:00:00Z")).next, "Next search Mon 9 Nov, 7am");
});

test("runSummary only flags a missed run after 6 hours of grace", () => {
  assert.equal(runSummary(ran("2026-10-26T07:05:00Z"), at("2026-11-02T07:30:00Z")).missed, false);
  assert.equal(runSummary(ran("2026-10-26T07:05:00Z"), at("2026-11-02T14:00:00Z")).missed, true);
});

test("runSummary flags a run two weeks old, not one after the latest scheduled time", () => {
  assert.equal(runSummary(ran("2026-10-15T12:00:00Z"), at("2026-10-29T12:00:00Z")).missed, true);
  assert.equal(runSummary(ran("2026-10-27T09:00:00Z"), at("2026-10-29T12:00:00Z")).missed, false);
});

test("runSummary next search is 7am UK time in both BST and GMT", () => {
  assert.equal(runSummary(null, at("2026-07-15T12:00:00Z")).next, "Next search Mon 20 Jul, 7am");
  assert.equal(runSummary(null, at("2026-12-02T12:00:00Z")).next, "Next search Mon 7 Dec, 7am");
  // 7am BST is 06:00 UTC, so the grace ends at 12:00 UTC, not 13:00
  assert.equal(runSummary(ran("2026-07-13T06:05:00Z"), at("2026-07-20T12:30:00Z")).missed, true);
});

test("runSummary gives what the last search found, on the last-search line", () => {
  const s = runSummary({ ...ran("2026-10-26T07:05:00Z"), found: 14, saved: 6 }, at("2026-10-29T12:00:00Z"));
  assert.deepEqual(s.found, { total: 14, new: 6 });
  assert.equal(s.last, "Last search Mon 26 Oct · found 14, 6 new");
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

test("gigStub gives the stub's date parts in UTC and the stamp tier", () => {
  assert.deepEqual(gigStub({ date: "2026-11-08", score: 52 }), { dow: "Sun", day: "8", mon: "Nov", tier: "hot" });
  assert.deepEqual(gigStub({ date: null, score: 41 }), { dow: null, day: null, mon: null, tier: "warm" });
  assert.equal(gigStub({ date: null, score: 10 }).tier, "");
});

test("gigDecisionPatch(null) clears the decision", () => {
  const at = new Date("2026-10-10T12:00:00Z");
  assert.deepEqual(gigDecisionPatch(null, at), { decision: null, decidedAt: at.toISOString() });
});

test("runSummary lists no problems when the search had no errors", () => {
  assert.deepEqual(runSummary(ran("2026-10-26T07:05:00Z"), at("2026-10-29T12:00:00Z")).problems, []);
});

test("runSummary lists one problem as where and message", () => {
  const s = runSummary({ ...ran("2026-10-26T07:05:00Z"), errors: [{ where: "Festivals", message: "timeout" }] }, at("2026-10-29T12:00:00Z"));
  assert.deepEqual(s.problems, [{ where: "Festivals", message: "timeout" }]);
});

test("runSummary lists every problem in order", () => {
  const errors = [{ where: "a", message: "1" }, { where: "b", message: "2" }, { where: "c", message: "3" }];
  assert.deepEqual(runSummary({ ...ran("2026-10-26T07:05:00Z"), errors }, at("2026-10-29T12:00:00Z")).problems, errors);
});

test("runSummary fills a problem's missing where or message with an empty string", () => {
  const s = runSummary({ ...ran("2026-10-26T07:05:00Z"), errors: [{ message: "boom" }, { where: "pasted" }] }, at("2026-10-29T12:00:00Z"));
  assert.deepEqual(s.problems, [{ where: "", message: "boom" }, { where: "pasted", message: "" }]);
});
