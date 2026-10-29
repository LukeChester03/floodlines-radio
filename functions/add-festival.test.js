import test from "node:test";
import assert from "node:assert/strict";
import { addPastedFestival } from "./add-festival.js";
import { gigId } from "./core/gigs.js";
import { fakeStore } from "./fakes.js";

const now = () => Date.parse("2026-10-10T12:00:00Z");
const url = "https://www.somefest.co.uk/apply";

test("saves a pasted festival at once as being read, and returns it", async () => {
  const store = fakeStore();
  const f = await addPastedFestival({ url: ` ${url} `, note: "  saw on insta " }, { store, now });
  assert.deepEqual(store.festivals[gigId(url)], {
    id: gigId(url), url, note: "saw on insta", source: "pasted", foundAt: "2026-10-10T12:00:00.000Z", tier: null,
  });
  assert.deepEqual(f, store.festivals[gigId(url)]);
});

test("the note is optional and capped at 1000 characters", async () => {
  const store = fakeStore();
  assert.equal((await addPastedFestival({ url }, { store, now })).note, "");
  assert.equal((await addPastedFestival({ url: url + "2", note: "x".repeat(1001) }, { store, now })).note, "");
});

test("a pasted festival is listed as being read, a tiered one is not", async () => {
  const store = fakeStore({ festivals: { g: { id: "g", tier: "good" } } });
  const f = await addPastedFestival({ url }, { store, now });
  assert.deepEqual(await store.listReadingFestivals(), [f]);
});

test("rejects a missing or non-http(s) link and saves nothing", async () => {
  const store = fakeStore();
  for (const input of [{ url: "festival.com" }, {}, undefined]) {
    await assert.rejects(addPastedFestival(input, { store, now }), { message: "Paste the festival's link" });
  }
  assert.deepEqual(store.festivals, {});
});

test("re-pasting a stored festival returns it unchanged", async () => {
  const id = gigId(url);
  const stored = { id, url, name: "Somefest", tier: "good", decision: "applied" };
  const store = fakeStore({ festivals: { [id]: stored } });
  assert.deepEqual(await addPastedFestival({ url, note: "again" }, { store, now }), stored);
  assert.deepEqual(store.festivals[id], stored);
});
