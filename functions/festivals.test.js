import test from "node:test";
import assert from "node:assert/strict";
import { importFestivals } from "./festivals.js";
import { gigId } from "./core/gigs.js";
import { fakeStore } from "./fakes.js";
import seed from "./data/festivals.json" with { type: "json" };

const now = () => Date.parse("2026-10-10T12:00:00Z");
const url = "https://a.example/apply";

test("importFestivals saves a festival under its gig id", async () => {
  const store = fakeStore();
  const res = await importFestivals({ store, festivals: [{ url, name: "A", tier: "good", applyBy: "2027-02-01", source: "seed" }], now });
  assert.deepEqual(res, { read: 1, saved: 1, errors: [] });
  const f = store.festivals[gigId(url)];
  assert.equal(f.name, "A");
  assert.equal(f.tier, "good");
  assert.equal(f.applyBy, "2027-02-01");
  assert.equal(f.source, "seed");
  assert.equal(f.topPick, false);
  assert.deepEqual(f.topReasons, []);
  assert.equal(f.foundAt, "2026-10-10T12:00:00.000Z");
});

test("importFestivals cleans tier, applyBy and text fields", async () => {
  const store = fakeStore();
  const u = (n) => `https://a.example/${n}`;
  await importFestivals({ store, festivals: [{ url: u(1), tier: "huge" }, { url: u(2), tier: "closed" }, { url: u(3), applyBy: "1 Feb" }, { url: u(4), name: 5 }], now });
  assert.equal(store.festivals[gigId(u(1))].tier, "worth");
  assert.equal(store.festivals[gigId(u(2))].tier, "closed");
  assert.equal(store.festivals[gigId(u(3))].applyBy, null);
  assert.equal(store.festivals[gigId(u(4))].name, "");
});

test("importFestivals keeps a top pick only with a reason, and at most 3 reasons", async () => {
  const store = fakeStore();
  const u = (n) => `https://a.example/${n}`;
  await importFestivals({ store, festivals: [{ url: u(1), topPick: true, topReasons: [] }, { url: u(2), topPick: true, topReasons: ["a", "", 3, "b", "c", "d"] }], now });
  assert.equal(store.festivals[gigId(u(1))].topPick, false);
  assert.equal(store.festivals[gigId(u(2))].topPick, true);
  assert.deepEqual(store.festivals[gigId(u(2))].topReasons, ["a", "b", "c"]);
});

test("importFestivals updates a festival but keeps the band's decision", async () => {
  const store = fakeStore({ festivals: { [gigId(url)]: { id: gigId(url), url, read: "old", decision: "applied" } } });
  await importFestivals({ store, festivals: [{ url, read: "new", decision: "skip" }], now });
  assert.equal(store.festivals[gigId(url)].read, "new");
  assert.equal(store.festivals[gigId(url)].decision, "applied");
});

test("importFestivals records festivals it can't read and saves the rest", async () => {
  const store = fakeStore();
  const res = await importFestivals({ store, festivals: [null, { name: "x" }, { url }], now });
  const err = { where: "(no url)", message: "could not read festival" };
  assert.deepEqual(res, { read: 3, saved: 1, errors: [err, err] });
  assert.deepEqual(await store.listFestivalIds(), [gigId(url)]);
});

test("the seed loads all 35 festivals", async () => {
  const store = fakeStore();
  assert.deepEqual(await importFestivals({ store, festivals: seed, now }), { read: 35, saved: 35, errors: [] });
  const all = Object.values(store.festivals);
  const count = (t) => all.filter((f) => f.tier === t).length;
  assert.deepEqual([count("good"), count("worth"), count("long"), count("closed")], [11, 11, 11, 2]);
  assert.equal(all.find((f) => f.name === "DonnyFest").applyBy, "2026-10-31");
});
