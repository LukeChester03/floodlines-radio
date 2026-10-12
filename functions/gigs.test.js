import test from "node:test";
import assert from "node:assert/strict";
import { gigRound } from "./gigs.js";
import { gigId } from "./core/gigs.js";
import { fakeStore } from "./fakes.js";

const now = () => Date.parse("2026-10-10T12:00:00Z");
const urls = ["https://a.com/1", "https://a.com/2", "https://a.com/3"];
const posts = urls.map((url) => ({ url, title: url, content: `post ${url}` }));
const search = async () => posts;
const reply = (isSlotOffer = true) => ({ isSlotOffer, date: "2026-10-20", town: "Brighton", howToApply: "email us" });

test("saves slot offers and records the run status", async () => {
  const store = fakeStore();
  const ask = async (p) => reply(!p.includes("/2"));
  await gigRound({ store, search, ask, now });
  assert.equal((await store.listGigIds()).length, 2);
  const s = await store.getGigStatus();
  assert.deepEqual([s.found, s.read, s.saved], [3, 3, 2]);
  assert.ok(s.ranAt && s.queries.length > 0);
});

test("an already-stored gig is not re-read and keeps its decision", async () => {
  const id = gigId(urls[0]);
  const store = fakeStore({ gigs: { [id]: { id, url: urls[0], decision: "applied" } } });
  const asked = [];
  const ask = async (p) => (asked.push(p), reply());
  await gigRound({ store, search, ask, now });
  assert.ok(!asked.some((p) => p.includes(urls[0])));
  assert.equal(store.gigs[id].decision, "applied");
});

test("a failed query and a failed read are recorded; the rest still save", async () => {
  const store = fakeStore();
  let n = 0;
  const flaky = async () => {
    if (n++ === 0) throw new Error("tavily down");
    return n === 2 ? posts : [];
  };
  const ask = async (p) => {
    if (p.includes("/2")) throw new Error("haiku down");
    return reply();
  };
  await gigRound({ store, search: flaky, ask, now });
  assert.equal((await store.listGigIds()).length, 2);
  const s = await store.getGigStatus();
  assert.equal(s.errors.length, 2);
  assert.ok(s.errors.every((e) => e.where && e.message));
});

test("empty areas and phrases fall back to the defaults", async () => {
  const store = fakeStore({ settings: { gigAreas: [], gigPhrases: [] } });
  await gigRound({ store, search, ask: async () => reply(), now });
  assert.ok((await store.getGigStatus()).queries.length > 0);
});
