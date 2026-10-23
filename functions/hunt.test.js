import test from "node:test";
import assert from "node:assert/strict";
import { gigHunt } from "./hunt.js";
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
