import test from "node:test";
import assert from "node:assert/strict";
import { fakeStore, fakeTransport } from "./fakes.js";
import { drain } from "./drain.js";
import { canSend, buildMessage } from "./core/message.js";
import { BAND_EMAIL } from "./core/band.js";

const NOW = Date.parse("2026-06-01T12:00:00Z");
const now = () => NOW;
const st = (id, over = {}) => ({ email: `${id}@x.com`, rec: {}, ...over });
const entry = (n, over = {}) => ({
  key: `s${n}:companion:pitch`, id: `s${n}`, song: "companion", kind: "pitch", to: `s${n}@x.com`,
  subject: "Hi", body: "Body", state: "approved", approvedAt: `2026-06-01T10:0${n}:00Z`, ...over,
});
const stations = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`s${i}`, st(`s${i}`)]));

test("sends one run's budget, one recipient each, and records every send", async () => {
  const store = fakeStore({ stations: stations(8), sendlist: Array.from({ length: 8 }, (_, i) => entry(i)) });
  const transport = fakeTransport();
  await drain({ store, transport, now });
  assert.equal(transport.sent.length, 5);
  assert.ok(transport.sent.every((m) => typeof m.to === "string" && m.from === BAND_EMAIL));
  const sends = await store.listSends({ since: 0 });
  assert.equal(sends.length, 5);
  assert.deepEqual(sends.map((s) => s.threadId), transport.sent.map((m) => m.threadId));
  assert.equal((await store.listSendlist({ state: "sent" })).length, 5);
  assert.equal((await store.listSendlist({ state: "approved" })).length, 3);
});

test("respects the daily cap", async () => {
  const old = Array.from({ length: 48 }, (_, i) => ({ id: `o${i}`, song: "x", kind: "pitch", sentAt: new Date(NOW - 3600e3).toISOString() }));
  const store = fakeStore({ stations: stations(5), sends: old, sendlist: Array.from({ length: 5 }, (_, i) => entry(i)) });
  const transport = fakeTransport();
  await drain({ store, transport, now });
  assert.equal(transport.sent.length, 2);
});

test("guardrail failures and transport errors fail the entry without sending", async () => {
  const prior = { id: "s2", song: "companion", kind: "pitch", to: "s2@x.com", sentAt: new Date(NOW - 3 * 86400e3).toISOString() };
  const store = fakeStore({
    stations: { s0: st("s0", { rec: { dnc: true } }), s1: st("s1", { email: "other@x.com" }), s2: st("s2"), s3: st("s3") },
    sends: [prior],
    sendlist: [entry(0), entry(1), entry(2), entry(3)],
  });
  const transport = fakeTransport();
  transport.send = async () => { throw new Error("boom"); };
  await drain({ store, transport, now });
  const all = await store.listSendlist();
  assert.ok(all.every((e) => e.state === "failed" && e.reason));
  assert.equal(all[3].reason, "boom");
  assert.equal((await store.listSends({ since: 0 })).length, 1);
  const ok = fakeTransport();
  await drain({ store, transport: ok, now });
  assert.equal(ok.sent.length, 0);
});

test("canSend reasons", () => {
  const e = entry(0);
  assert.equal(canSend(e, st("s0"), []), null);
  assert.ok(canSend(e, undefined, []));
  assert.ok(canSend(e, st("s0", { rec: { bounced: "s0@x.com" } }), []));
  assert.equal(canSend(e, st("s0", { rec: { bounced: "old@x.com" } }), []), null);
  assert.equal(canSend(entry(0, { kind: "followup" }), st("s0"), [{ id: "s0", song: "companion", kind: "pitch" }]), null);
});

test("follow-up threads onto the earlier pitch", () => {
  const prior = { messageId: "<m1>", threadId: "t1" };
  const m = buildMessage(entry(0, { kind: "followup" }), BAND_EMAIL, prior);
  assert.deepEqual(m, { from: BAND_EMAIL, to: "s0@x.com", subject: "Hi", body: "Body", threadId: "t1", inReplyTo: "<m1>" });
  assert.equal(buildMessage(entry(0), BAND_EMAIL).threadId, undefined);
});
