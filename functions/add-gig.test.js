import test from "node:test";
import assert from "node:assert/strict";
import { addPastedGig } from "./add-gig.js";
import { gigId } from "./core/gigs.js";
import { fakeStore } from "./fakes.js";

const now = () => Date.parse("2026-10-10T12:00:00Z");
const url = "https://www.instagram.com/p/abc/?utm_source=x";
const text = "Support slot wanted, Brighton, 2026-10-20. Email us. " + "x".repeat(400);

test("saves a pasted gig at once as being read, and returns it", async () => {
  const store = fakeStore();
  const gig = await addPastedGig({ url, text }, { store, now });
  assert.deepEqual(store.gigs[gigId(url)], {
    id: gigId(url), url, text, source: "pasted", excerpt: text.slice(0, 280), foundAt: "2026-10-10T12:00:00.000Z", score: null, reasons: [],
  });
  assert.equal(gig.excerpt.length, 280);
  assert.deepEqual(gig, store.gigs[gig.id]);
});

test("re-pasting a gig keeps the band's decision", async () => {
  const id = gigId(url);
  const store = fakeStore({ gigs: { [id]: { id, url, decision: "applied" } } });
  await addPastedGig({ url, text }, { store, now });
  assert.equal(store.gigs[id].decision, "applied");
  assert.equal(store.gigs[id].score, null);
});

test("rejects an empty text or a non-http(s) url and saves nothing", async () => {
  const store = fakeStore();
  for (const input of [{ url, text: "  " }, { url: "ftp://x.com/a", text }, { url: "nonsense", text }, {}]) {
    await assert.rejects(addPastedGig(input, { store, now }), { message: "Paste the post's link and its text" });
  }
  assert.deepEqual(await store.listGigIds(), []);
});
