import test from "node:test";
import assert from "node:assert/strict";
import { queueProgress, failureReason } from "./progress.js";

const at = (h, m, s = 0) => new Date(Date.UTC(2026, 0, 5, h, m, s));
const pace = { perRun: 5, perDay: 50 };

test("queueProgress counts states and sends since 00:00 UTC today", () => {
  const now = at(14, 3, 20);
  const entries = [{ state: "review" }, { state: "approved" }, { state: "approved" }, { state: "failed" }];
  const sends = [
    ...Array.from({ length: 12 }, (_, i) => ({ sentAt: new Date(now - (i + 1) * 3600e3).toISOString() })),
    { sentAt: new Date(Date.UTC(2026, 0, 4, 23, 59)).toISOString() },
    { sentAt: new Date(now - 30 * 3600e3).toISOString() },
  ];
  assert.deepEqual(queueProgress(entries, sends, pace, now), {
    review: 1, approved: 2, sending: 0, failed: 1, sentToday: 12, cap: 50, nextRunAt: new Date(Date.UTC(2026, 0, 6, 8, 0)).toISOString(),
  });
});

test("nextRunAt is the next 08:00 UTC, strictly after now", () => {
  assert.equal(queueProgress([], [], pace, at(7, 59)).nextRunAt, at(8, 0).toISOString());
  assert.equal(queueProgress([], [], pace, at(8, 0)).nextRunAt, new Date(Date.UTC(2026, 0, 6, 8, 0)).toISOString());
  assert.equal(queueProgress([], [], pace, at(23, 59)).nextRunAt, new Date(Date.UTC(2026, 0, 6, 8, 0)).toISOString());
});

test("entries with no state count as review", () => {
  assert.equal(queueProgress([{}], [], pace, at(1, 0)).review, 1);
});

test("failureReason returns the recorded reason for a failed entry", () => {
  assert.equal(failureReason({ state: "failed", reason: "Station is do-not-contact" }), "Station is do-not-contact");
});

test("failureReason falls back when a failed entry has no reason", () => {
  assert.equal(failureReason({ state: "failed" }), "Couldn't send, no reason recorded");
});

test("failureReason is null for an entry that isn't failed", () => {
  assert.equal(failureReason({ state: "approved", reason: "old" }), null);
});
