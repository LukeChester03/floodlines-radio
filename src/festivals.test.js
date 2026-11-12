import test from "node:test";
import assert from "node:assert/strict";
import { festivalView } from "./festivals.js";

const now = new Date("2026-11-01T12:00:00Z").getTime();
const f = (id, tier, extra = {}) => ({ id, name: id, tier, applyBy: null, ...extra });

test("festivalView groups by tier in order, leaving out empty tiers", () => {
  const out = festivalView([f("l", "long"), f("g", "good"), f("c", "closed")], { now });
  assert.deepEqual(out.map(x => [x.tier, x.title]), [["good", "Good shot"], ["long", "Long shot"], ["closed", "Closed"]]);
});

test("festivalView lists top picks first, then soonest applyBy, undated last", () => {
  const out = festivalView([f("B", "good", { applyBy: "2026-12-01" }), f("C", "good"), f("A", "good", { topPick: true, applyBy: "2027-01-01" })], { now });
  assert.deepEqual(out[0].festivals.map(x => x.id), ["A", "B", "C"]);
});

test("festivalView marks closingSoon from today up to 14 days ahead", () => {
  const dates = ["2026-11-01", "2026-11-15", "2026-11-16", "2026-10-31", null];
  const out = festivalView(dates.map(d => f(String(d), "good", { applyBy: d })), { now });
  const soon = Object.fromEntries(out.flatMap(t => t.festivals).map(x => [x.id, x.closingSoon]));
  assert.deepEqual(soon, { "2026-11-01": true, "2026-11-15": true, "2026-11-16": false, "2026-10-31": false, null: false });
});

test("festivalView filters by decision, new meaning undecided", () => {
  const fs = [f("a", "good", { decision: "applied" }), f("b", "good"), f("c", "worth", { decision: "passed" })];
  const ids = decision => festivalView(fs, { now, decision }).flatMap(t => t.festivals.map(x => x.id));
  assert.deepEqual(ids("new"), ["b"]);
  assert.deepEqual(ids("applied"), ["a"]);
  assert.deepEqual(ids("all"), ["a", "b", "c"]);
});

test("festivalView puts festivals still being read first", () => {
  const out = festivalView([f("g", "good"), f("x", null)], { now });
  assert.deepEqual(out.map(t => [t.tier, t.title, t.festivals.map(x => x.id)]), [[null, "Being read", ["x"]], ["good", "Good shot", ["g"]]]);
});

const nov12 = new Date("2026-11-12T12:00:00Z").getTime();
const byTier = out => Object.fromEntries(out.map(t => [t.tier, t.festivals.map(x => x.id)]));

test("festivalView moves a festival whose applyBy has passed into Closed", () => {
  const out = festivalView([f("past", "worth", { applyBy: "2026-11-11" })], { now: nov12 });
  assert.deepEqual(out.map(t => [t.tier, t.title, t.festivals.map(x => x.id)]), [["closed", "Closed", ["past"]]]);
});

test("festivalView keeps a festival due today or undated in its own tier", () => {
  const out = festivalView([f("today", "worth", { applyBy: "2026-11-12" }), f("undated", "worth")], { now: nov12 });
  assert.deepEqual(byTier(out), { worth: ["today", "undated"] });
});

test("festivalView keeps a festival still being read in Being read, even past its date", () => {
  const out = festivalView([f("x", null, { applyBy: "2026-11-01" })], { now: nov12 });
  assert.deepEqual(out.map(t => [t.title, t.festivals.map(x => x.id)]), [["Being read", ["x"]]]);
});

test("festivalView puts reader-closed and past-dated festivals in one Closed group, last", () => {
  const out = festivalView([f("c", "closed"), f("p", "good", { applyBy: "2026-10-01" }), f("o", "long")], { now: nov12 });
  assert.deepEqual(out.map(t => t.tier), ["long", "closed"]);
  assert.deepEqual(out.at(-1).festivals.map(x => x.id).sort(), ["c", "p"]);
});
