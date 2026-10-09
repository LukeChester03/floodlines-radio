import test from "node:test";
import assert from "node:assert/strict";
import { fakeStore, fakeTransport } from "./fakes.js";
import { drain } from "./drain.js";
import { handleCallback, secretReader } from "./connect.js";
import { gmailTransport } from "./gmail.js";
import { BAND_EMAIL } from "./core/band.js";

const deps = (email) => {
  const writes = [];
  const store = fakeStore({ status: { connected: null, needsReconnect: true } });
  return {
    writes, store,
    d: { exchangeCode: async () => ({ email, refreshToken: "rt" }), writeSecret: async (v) => writes.push(v), store },
  };
};

test("callback rejects a non-band account and writes nothing", async () => {
  const { writes, store, d } = deps("someone@else.com");
  await assert.rejects(handleCallback({ code: "c" }, d));
  assert.equal(writes.length, 0);
  assert.deepEqual(await store.getStatus(), { connected: null, needsReconnect: true });
});

test("callback stores the band's refresh token and marks connected", async () => {
  const { writes, store, d } = deps(BAND_EMAIL);
  await handleCallback({ code: "c" }, d);
  assert.deepEqual(writes, ["rt"]);
  const s = await store.getStatus();
  assert.equal(s.connected, BAND_EMAIL);
  assert.equal(s.needsReconnect, false);
});

test("an auth error stops drain, leaves entries approved, and later runs send nothing", async () => {
  const stations = Object.fromEntries([0, 1, 2].map((i) => [`s${i}`, { email: `s${i}@x.com`, rec: {} }]));
  const sendlist = [0, 1, 2].map((i) => ({ key: `k${i}`, id: `s${i}`, song: "a", kind: "pitch", to: `s${i}@x.com`, subject: "Hi", body: "B", state: "approved", approvedAt: `2026-06-01T10:0${i}:00Z` }));
  const store = fakeStore({ stations, sendlist });
  let calls = 0;
  const transport = fakeTransport();
  transport.send = async () => { calls += 1; throw Object.assign(new Error("revoked"), { code: "auth" }); };
  await drain({ store, transport, now: () => Date.parse("2026-06-01T12:00:00Z") });
  assert.equal((await store.getStatus()).needsReconnect, true);
  assert.equal((await store.listSendlist({ state: "approved" })).length, 3);
  assert.equal((await store.listSends({ since: 0 })).length, 0);
  assert.equal(calls, 1);
  await drain({ store, transport });
  assert.equal(calls, 1);
});

test("real Gmail is disabled under test, with no network", async () => {
  const real = globalThis.fetch;
  let hit = false;
  globalThis.fetch = () => { hit = true; throw new Error("network"); };
  try {
    await assert.rejects(async () => gmailTransport({ clientId: "a", clientSecret: "b", refreshToken: "c" }).send({ from: BAND_EMAIL, to: "x@y.com", subject: "s", body: "b" }), /Real Gmail is disabled outside deployed functions/);
  } finally {
    globalThis.fetch = real;
  }
  assert.equal(hit, false);
});

test("secretReader fetches the latest secret version", async () => {
  const real = globalThis.fetch;
  let url;
  globalThis.fetch = async (u) => { url = u; return { ok: true, json: async () => ({ payload: { data: Buffer.from("rt2").toString("base64") } }) }; };
  try {
    assert.equal(await secretReader({ secret: "S", project: "p", getAccessToken: async () => "t" })(), "rt2");
  } finally {
    globalThis.fetch = real;
  }
  assert.match(url, /projects\/p\/secrets\/S\/versions\/latest:access$/);
});
