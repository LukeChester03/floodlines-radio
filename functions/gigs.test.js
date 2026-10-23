import test from "node:test";
import assert from "node:assert/strict";
import { gigRound, importGigs } from "./gigs.js";
import { gigId } from "./core/gigs.js";
import { fakeStore } from "./fakes.js";

const now = () => Date.parse("2026-10-10T12:00:00Z");
const urls = ["https://a.com/1", "https://a.com/2", "https://a.com/3"];
const posts = urls.map((url) => ({ url, title: url, content: `post ${url}` }));
const search = async () => posts;
const reply = (isSlotOffer = true) => ({ isSlotOffer, date: "2026-10-20", town: "Bristol", howToApply: "email us" });

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

const offer = (url, o = {}) => ({ url, text: `post ${url}`, source: "search", isSlotOffer: true, date: "2026-10-20", town: "Bristol", ...o });

test("importGigs keeps only search posts in the default areas", async () => {
  const store = fakeStore();
  await importGigs({ store, posts: [offer(urls[0]), offer(urls[1], { town: "Brighton" })], now });
  assert.deepEqual(await store.listGigIds(), [gigId(urls[0])]);
  assert.equal(typeof store.gigs[gigId(urls[0])].score, "number");
});

test("importGigs keeps a pasted post whatever its area or date, and scores it", async () => {
  const store = fakeStore();
  await importGigs({ store, posts: [offer(urls[0], { source: "pasted", town: "Leeds", date: undefined })], now });
  const g = store.gigs[gigId(urls[0])];
  assert.equal(g.source, "pasted");
  assert.equal(typeof g.score, "number");
  assert.ok(g.reasons.includes("Date not given"));
});

test("importGigs cleans fields: vague date, bad bands and non-string venue", async () => {
  const store = fakeStore();
  const bands = [{ name: "" }, { name: 3 }, { name: "Pale Ponies", link: 5 }];
  await importGigs({ store, posts: [offer(urls[0], { source: "pasted", date: "next friday", bands, venue: 12 })], now });
  const g = store.gigs[gigId(urls[0])];
  assert.equal(g.date, null);
  assert.deepEqual(g.bands, [{ name: "Pale Ponies" }]);
  assert.equal(g.venue, "");
});

test("importGigs records posts it can't read and saves the rest", async () => {
  const store = fakeStore();
  const res = await importGigs({ store, posts: [null, { text: "x" }, offer(urls[0])], now });
  assert.deepEqual(res, {
    read: 3, saved: 1,
    errors: [{ where: "(no url)", message: "could not read post" }, { where: "(no url)", message: "could not read post" }],
  });
});
