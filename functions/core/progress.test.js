import test from "node:test";
import assert from "node:assert/strict";
import { queueProgress, failureReason } from "./progress.js";

const at = (h, m, s = 0) => new Date(Date.UTC(2026, 0, 5, h, m, s));
const pace = { perRun: 5, perDay: 50 };

test("queueProgress counts states and sends in the last 24h", () => {
  const now = at(14, 3, 20);
  const entries = [{ state: "review" }, { state: "approved" }, { state: "approved" }, { state: "failed" }];
  const sends = [
    ...Array.from({ length: 12 }, (_, i) => ({ sentAt: new Date(now - (i + 1) * 3600e3).toISOString() })),
    { sentAt: new Date(now - 30 * 3600e3).toISOString() },
  ];
  assert.deepEqual(queueProgress(entries, sends, pace, now), {
    review: 1, approved: 2, sending: 0, failed: 1, sentToday: 12, cap: 50, nextRunAt: at(14, 10).toISOString(),
  });
});

test("nextRunAt is the next 10-minute boundary, strictly after now", () => {
  assert.equal(queueProgress([], [], pace, at(14, 3, 20)).nextRunAt, at(14, 10).toISOString());
  assert.equal(queueProgress([], [], pace, at(14, 10)).nextRunAt, at(14, 20).toISOString());
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
