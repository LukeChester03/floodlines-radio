import test from "node:test";
import assert from "node:assert/strict";
import { fakeStore } from "./fakes.js";
import { approveBatch, approvalSummary } from "./approve.js";

test("approveBatch approves review and stateless entries only", async () => {
  const store = fakeStore({ sendlist: [
    { key: "A", state: "review" }, { key: "B" }, { key: "C", state: "sent" }, { key: "D", state: "failed" },
  ] });
  const now = () => 1000;
  const r = await approveBatch({ keys: ["A", "B", "C", "D"] }, { store, now });
  assert.deepEqual(r, { approved: 2 });
  const all = Object.fromEntries((await store.listSendlist()).map((e) => [e.key, e]));
  assert.equal(all.A.state, "approved");
  assert.ok(all.A.approvedAt);
  assert.equal(all.B.state, "approved");
  assert.ok(all.B.approvedAt);
  assert.deepEqual(all.C, { key: "C", state: "sent" });
  assert.deepEqual(all.D, { key: "D", state: "failed" });
});

test("approvalSummary counts emails, stations and songs", () => {
  const s = approvalSummary([
    { id: "s1", song: "companion" }, { id: "s2", song: "final-fear" }, { id: "s1", song: "final-fear" },
  ]);
  assert.deepEqual(s, { emails: 3, stations: 2, songs: ["companion", "final-fear"] });
});
