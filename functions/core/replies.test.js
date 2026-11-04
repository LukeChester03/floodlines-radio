import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, matchReply } from "./replies.js";

const band = "band@gmail.com";
const msg = (o = {}) => ({ id: "m", threadId: "x", from: "a@b.com", headers: {}, ...o });
const sends = [{ id: "1", song: "companion", kind: "pitch", to: "jo@station.com", messageId: "<mid1>", threadId: "t1" }];
const stations = [{ id: "s0", email: null }, { id: "s1", email: "jo@station.com" }];

test("matches by threadId", () => {
  assert.deepEqual(matchReply(msg({ threadId: "t1" }), sends, stations), { stationId: "s1", song: "companion", songs: ["companion"], kind: "pitch" });
});

test("matches by in-reply-to / references on another thread", () => {
  const m = msg({ headers: { "in-reply-to": "<mid1>" } });
  assert.deepEqual(matchReply(m, sends, stations), { stationId: "s1", song: "companion", songs: ["companion"], kind: "pitch" });
  const r = msg({ headers: { references: "<other> <mid1>" } });
  assert.equal(matchReply(r, sends, stations).stationId, "s1");
});

test("falls back to sender address, else null", () => {
  const m = msg({ from: "Jo <Jo@Station.com>" });
  assert.deepEqual(matchReply(m, sends, stations), { stationId: "s1", song: "companion", songs: ["companion"], kind: "pitch" });
  assert.deepEqual(matchReply(msg({ from: "Jo@Station.com" }), [], stations), { stationId: "s1", song: null, songs: [], kind: null });
  assert.equal(matchReply(msg(), sends, stations), null);
});

test("a multi-song send matches every song it named", () => {
  const multi = [{ id: "crags", song: "finalfear", songs: ["finalfear", "companion"], to: "jo@station.com", threadId: "t1" }];
  const hit = matchReply(msg({ threadId: "t1" }), multi, stations);
  assert.equal(hit.song, "finalfear");
  assert.deepEqual(hit.songs, ["finalfear", "companion"]);
  assert.deepEqual(matchReply(msg({ from: "jo@station.com" }), multi, stations).songs, ["finalfear", "companion"]);
});

test("classify", () => {
  assert.equal(classify(msg({ from: band }), band), "own");
  assert.equal(classify(msg({ from: "MAILER-DAEMON@googlemail.com" }), band), "bounced");
  assert.equal(classify(msg({ headers: { "auto-submitted": "auto-replied" } }), band), "auto");
  assert.equal(classify(msg({ from: "no-reply@x.com" }), band), "auto");
  assert.equal(classify(msg({ headers: { "auto-submitted": "no" } }), band), "replied");
  assert.equal(classify(msg(), band), "replied");
});
