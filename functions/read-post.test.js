import test from "node:test";
import assert from "node:assert/strict";
import { readPost } from "./read-post.js";

const now = () => Date.parse("2026-10-10T12:00:00Z");
const post = { url: "https://x.com/gig", text: "Open slot! ".repeat(60), source: "search" };

test("a slot offer reply becomes a gig; prompt has the text and today's date", async () => {
  let prompt;
  const ask = async (p) => ((prompt = p), { isSlotOffer: true, date: "2026-11-14", town: "Brighton", bands: [{ name: "Wet Leg" }], howToApply: "DM us" });
  const gig = await readPost(post, { ask, now });
  assert.equal(gig.isSlotOffer, true);
  assert.equal(gig.date, "2026-11-14");
  assert.equal(gig.town, "Brighton");
  assert.deepEqual(gig.bands, [{ name: "Wet Leg" }]);
  assert.equal(gig.howToApply, "DM us");
  assert.equal(gig.source, "search");
  assert.equal(gig.url, post.url);
  assert.equal(gig.excerpt, post.text.slice(0, 280));
  assert.equal(gig.id, undefined);
  assert.ok(gig.foundAt);
  assert.ok(prompt.includes(post.text) && prompt.includes("2026-10-10"));
});

test("a vague date becomes null and missing bands become []", async () => {
  const gig = await readPost(post, { ask: async () => ({ isSlotOffer: true, date: "next Friday" }), now });
  assert.equal(gig.date, null);
  assert.deepEqual(gig.bands, []);
});

test("ask throwing or returning a non-object gives null", async () => {
  assert.equal(await readPost(post, { ask: async () => { throw new Error("boom"); }, now }), null);
  assert.equal(await readPost(post, { ask: async () => "nope", now }), null);
  assert.equal(await readPost(post, { ask: async () => null, now }), null);
});
