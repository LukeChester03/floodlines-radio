import test from "node:test";
import assert from "node:assert/strict";
import { gigHunt, readPasted } from "./hunt.js";
import { gigId } from "./core/gigs.js";
import { fakeStore } from "./fakes.js";

const now = () => Date.parse("2026-10-10T12:00:00Z");
const offer = (url) => ({ url, text: `post ${url}`, isSlotOffer: true, date: "2026-10-20", town: "Bristol", county: "Bristol", howToApply: "email us" });

test("empty settings split the default areas into two sessions", async () => {
  const prompts = [];
  await gigHunt({ store: fakeStore(), runSession: async (p) => (prompts.push(p), "[]"), now });
  assert.equal(prompts.length, 2);
  assert.ok(prompts[0].includes("Bristol") && prompts[0].includes("Gloucestershire"));
  assert.ok(prompts[1].includes("Berkshire") && prompts[1].includes("London"));
});

test("a stored gig keeps its decision; only the new post is added", async () => {
  const [a, b] = ["https://a.com/1", "https://a.com/2"];
  const id = gigId(a);
  const store = fakeStore({ gigs: { [id]: { id, url: a, decision: "applied" } } });
  let n = 0;
  const runSession = async () => (n++ === 0 ? JSON.stringify([offer(a), offer(b)]) : "[]");
  const s = await gigHunt({ store, runSession, now });
  assert.equal(s.read, 1);
  assert.deepEqual((await store.listGigIds()).sort(), [id, gigId(b)].sort());
  assert.equal(store.gigs[id].decision, "applied");
});

test("a failed session is recorded and the other one's fenced answer still saves", async () => {
  const store = fakeStore();
  let n = 0;
  const runSession = async () => {
    if (n++ === 0) throw new Error("claude crashed");
    return "Here you go:\n```json\n" + JSON.stringify([offer("https://a.com/3")]) + "\n```\nGood luck!";
  };
  await gigHunt({ store, runSession, now });
  assert.deepEqual(await store.listGigIds(), [gigId("https://a.com/3")]);
  const s = await store.getGigStatus();
  assert.equal(s.errors.length, 1);
  assert.equal(s.errors[0].where, "Bristol + Gloucestershire");
});

test("an unparseable answer is an error for its area group", async () => {
  const store = fakeStore();
  let n = 0;
  const s = await gigHunt({ store, runSession: async () => (n++ === 0 ? "[]" : "Sorry, I found nothing."), now });
  assert.deepEqual(s.errors.map((e) => e.where), ["Berkshire + London"]);
});

test("the run status is written to gigstatus/last", async () => {
  const store = fakeStore();
  await gigHunt({ store, runSession: async () => JSON.stringify([offer("https://a.com/4")]), now });
  const s = await store.getGigStatus();
  assert.equal(s.ranAt, "2026-10-10T12:00:00.000Z");
  assert.equal(s.queries.length, 2);
  assert.deepEqual([s.found, s.read, s.saved], [2, 2, 1]);
});

const reading = (url) => ({ id: gigId(url), url, text: `pasted ${url}`, source: "pasted", score: null, reasons: [] });

test("with no gigs being read, no session runs", async () => {
  let calls = 0;
  const r = await readPasted({ store: fakeStore(), runSession: async () => (calls++, "[]"), now });
  assert.equal(calls, 0);
  assert.deepEqual(r, { read: 0, saved: 0, errors: [] });
});

test("one session reads every queued post; a post missing from the answer stays queued", async () => {
  const [a, b] = ["https://a.com/p/A", "https://a.com/p/B"];
  const store = fakeStore({ gigs: { [gigId(a)]: reading(a), [gigId(b)]: reading(b) } });
  const prompts = [];
  const runSession = async (p) => (prompts.push(p), JSON.stringify([{ ...offer(a), text: "model's copy" }]));
  await readPasted({ store, runSession, now });
  assert.equal(prompts.length, 1);
  assert.ok(prompts[0].includes(a) && prompts[0].includes(b));
  assert.equal(typeof store.gigs[gigId(a)].score, "number");
  assert.equal(store.gigs[gigId(a)].text, `pasted ${a}`);
  assert.equal(store.gigs[gigId(b)].score, null);
  assert.deepEqual(await store.getGigStatus(), {});
});

test("a session that throws leaves the gig queued", async () => {
  const a = "https://a.com/p/C";
  const store = fakeStore({ gigs: { [gigId(a)]: reading(a) } });
  const r = await readPasted({ store, runSession: async () => { throw new Error("claude crashed"); }, now });
  assert.deepEqual(store.gigs[gigId(a)], reading(a));
  assert.equal(r.errors.length, 1);
});
