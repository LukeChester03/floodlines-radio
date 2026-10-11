import test from "node:test";
import assert from "node:assert/strict";
import { addPastedGig } from "./add-gig.js";
import { gigId } from "./core/gigs.js";
import { fakeStore } from "./fakes.js";

const now = () => Date.parse("2026-10-10T12:00:00Z");
const url = "https://www.instagram.com/p/abc/?utm_source=x";
const text = "Support slot wanted, Brighton, 2026-10-20. Email us.";
const ask = async () => ({ isSlotOffer: true, date: "2026-10-20", town: "Brighton", howToApply: "email us" });

test("saves a pasted gig with its stable id and returns it", async () => {
  const store = fakeStore();
  const gig = await addPastedGig({ url, text }, { store, ask, now });
  assert.equal(gig.source, "pasted");
  assert.equal(gig.id, gigId(url));
  assert.ok(gig.score > 0 && gig.reasons.length > 0);
  assert.equal(store.gigs[gig.id].url, url);
});

test("a pasted gig outside the areas and date window is kept, and an existing decision survives", async () => {
  const id = gigId(url);
  const store = fakeStore({ gigs: { [id]: { id, url, decision: "applied" } } });
  const far = async () => ({ isSlotOffer: false, date: "2027-06-01", town: "Aberdeen" });
  await addPastedGig({ url, text }, { store, ask: far, now });
  assert.equal(store.gigs[id].town, "Aberdeen");
  assert.equal(store.gigs[id].decision, "applied");
});

test("rejects an empty text or a non-http(s) url and saves nothing", async () => {
  const store = fakeStore();
  for (const input of [{ url, text: "  " }, { url: "ftp://x.com/a", text }, { url: "nonsense", text }, {}]) {
    await assert.rejects(addPastedGig(input, { store, ask, now }), { message: "Paste the post's link and its text" });
  }
  assert.deepEqual(await store.listGigIds(), []);
});

test("rejects when the post can't be read and saves nothing", async () => {
  const store = fakeStore();
  const bad = async () => { throw new Error("haiku down"); };
  await assert.rejects(addPastedGig({ url, text }, { store, ask: bad, now }), { message: "Couldn't read that post" });
  assert.deepEqual(await store.listGigIds(), []);
});
