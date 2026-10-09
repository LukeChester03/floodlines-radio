import test from "node:test";
import assert from "node:assert/strict";
import { entryStateWrites } from "./entryState.js";

const user = { email: "band@example.com" };
const now = new Date("2026-01-05T10:00:00Z");

test("Retry writes one approved state plus the stamp, nothing else", () => {
  assert.deepEqual(entryStateWrites(["k1"], "approved", user, now), [
    { path: "sendlist/k1", data: { state: "approved", updatedAt: now.toISOString(), updatedBy: "band@example.com" } },
  ]);
});

test("Pause all writes review once per key", () => {
  const writes = entryStateWrites(["k1", "k2"], "review", user, now);
  assert.deepEqual(writes.map(w => w.path), ["sendlist/k1", "sendlist/k2"]);
  assert.ok(writes.every(w => w.data.state === "review"));
});

test("clients can't set sent or failed", () => {
  for (const s of ["sent", "failed"]) assert.throws(() => entryStateWrites(["k1"], s, user, now));
});
