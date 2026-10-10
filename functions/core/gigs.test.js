import test from "node:test";
import assert from "node:assert/strict";
import { matchGigs, gigId } from "./gigs.js";

const now = new Date("2026-06-01T12:00:00Z");
const day = n => new Date(now.getTime() + n * 864e5).toISOString().slice(0, 10);
const cand = (o = {}) => ({
  url: "https://x.example/a", source: "search", title: "Gig", date: day(14), venue: "", town: "Brighton",
  county: "", genre: "", bands: [], howToApply: "", isSlotOffer: true, excerpt: "", foundAt: now.toISOString(), ...o,
});
const opts = { areas: ["Brighton"], similarArtists: [] };

test("keeps only in-area slot offers dated from now to 42 days ahead", () => {
  const out = matchGigs([
    cand({ url: "https://x.example/1" }),
    cand({ url: "https://x.example/2", town: "Leeds" }),
    cand({ url: "https://x.example/3", date: day(70) }),
    cand({ url: "https://x.example/4", date: day(-1) }),
  ], opts, now);
  assert.deepEqual(out.map(g => g.url), ["https://x.example/1"]);
});

test("same URL modulo slash and utm params is one gig with one id", () => {
  const a = "https://X.example/a/", b = "https://x.example/a?utm_source=ig";
  assert.equal(gigId(a), gigId(b));
  assert.equal(matchGigs([cand({ url: a }), cand({ url: b })], opts, now).length, 1);
});

test("similar artist on the bill ranks first with a reason", () => {
  const out = matchGigs([
    cand({ url: "https://x.example/1" }),
    cand({ url: "https://x.example/2", bands: [{ name: "The Amazons", link: "" }] }),
  ], { ...opts, similarArtists: ["The Amazons"] }, now);
  assert.equal(out[0].url, "https://x.example/2");
  assert.ok(out[0].reasons.includes("Bill includes The Amazons"));
});

test("undated gigs are kept, non slot offers dropped", () => {
  const out = matchGigs([cand({ date: null }), cand({ url: "https://x.example/n", isSlotOffer: false })], opts, now);
  assert.equal(out.length, 1);
  assert.ok(out[0].reasons.includes("Date not given"));
});
