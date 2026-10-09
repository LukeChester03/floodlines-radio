import { firestoreStore } from "./store.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeTransport, fakeStore } from "./fakes.js";
import { requireBand } from "./auth.js";
import { BAND_EMAIL } from "./core/band.js";
import { band } from "../src/songs.js";

test("fakeTransport sends one recipient and records it", async () => {
  const t = fakeTransport();
  const r = await t.send({ to: "a@x.com", subject: "s", body: "b" });
  assert.ok(r.messageId && r.threadId);
  assert.equal(t.sent.length, 1);
});

test("fakeTransport rejects more than one address", async () => {
  const t = fakeTransport();
  for (const to of ["a@x.com, b@y.com", "a@x.com; b@y.com", ["a@x.com", "b@y.com"], ["a@x.com, b@y.com"], undefined, ""]) {
    await assert.rejects(t.send({ to, subject: "s", body: "b" }));
  }
  assert.equal(t.sent.length, 0);
});

test("fakeTransport plays back the inbox", async () => {
  const t = fakeTransport({ inbox: [{ id: 1 }] });
  const { messages } = await t.listNewMessages(null);
  assert.equal(messages.length, 1);
});

test("requireBand only lets the band account through", () => {
  assert.throws(() => requireBand({ auth: { token: { email: "someone@else.com" } } }), { code: "permission-denied" });
  assert.throws(() => requireBand({}), { code: "permission-denied" });
  requireBand({ auth: { token: { email: BAND_EMAIL } } });
});

test("app band.email reads from BAND_EMAIL", () => {
  assert.equal(band.email, BAND_EMAIL);
});

test("fakeStore lists the sendlist by state", async () => {
  const s = fakeStore({ sendlist: [{ key: "a", state: "approved" }, { key: "b", state: "review" }] });
  assert.deepEqual((await s.listSendlist({ state: "approved" })).map((e) => e.key), ["a"]);
  await s.updateEntry("b", { state: "approved" });
  assert.equal((await s.listSendlist({ state: "approved" })).length, 2);
});

test("fakeStore stations, sends and status", async () => {
  const s = fakeStore({ stations: { x: { email: "x@x.com", rec: { dnc: false } } } });
  await s.updateStation("x", { dnc: true });
  assert.deepEqual(await s.getStation("x"), { email: "x@x.com", rec: { dnc: true } });
  await s.addSend({ sentAt: 5 });
  await s.addSend({ sentAt: 1 });
  assert.equal((await s.listSends({ since: 2 })).length, 1);
  await s.setStatus({ ok: true });
  assert.deepEqual(await s.getStatus(), { ok: true });
});

test("firestoreStore.getStation joins the static email onto the CRM record", async () => {
  const doc = (data) => ({ get: async () => ({ exists: !!data, data: () => data }) });
  const db = { doc: (p) => doc(p === "stations/a" ? { dnc: true } : undefined) };
  const s = firestoreStore(db, [{ id: "a", email: "a@x.com" }, { id: "b", email: "b@x.com" }]);
  assert.deepEqual(await s.getStation("a"), { email: "a@x.com", rec: { dnc: true } });
  assert.deepEqual(await s.getStation("b"), { email: "b@x.com", rec: {} });
  assert.equal(await s.getStation("zzz"), undefined);
});
