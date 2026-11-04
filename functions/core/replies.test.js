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

const thread = [
  { id: "p", song: "finalfear", kind: "pitch", to: "jo@station.com", sentAt: "2026-05-01T10:00:00Z", messageId: "<pitch>", threadId: "t1" },
  { id: "f", song: "finalfear", songs: ["finalfear", "companion"], kind: "followup", to: "jo@station.com", sentAt: "2026-06-01T10:00:00Z", messageId: "<fu>", threadId: "t1" },
];

test("a thread holding a pitch and a follow-up matches the newest send", () => {
  assert.deepEqual(matchReply(msg({ threadId: "t1" }), thread, stations).songs, ["finalfear", "companion"]);
  const chain = msg({ threadId: "t1", headers: { "in-reply-to": "<fu>", references: "<pitch> <fu>" } });
  assert.deepEqual(matchReply(chain, thread, stations).songs, ["finalfear", "companion"]);
});

test("a reply naming the older pitch matches that pitch, not the newer follow-up", () => {
  const m = msg({ threadId: "t1", headers: { "in-reply-to": "<pitch>", references: "<pitch>" } });
  assert.deepEqual(matchReply(m, thread, stations).songs, ["finalfear"]);
});

test("classify", () => {
  assert.equal(classify(msg({ from: band }), band), "own");
  assert.equal(classify(msg({ from: "MAILER-DAEMON@googlemail.com" }), band), "bounced");
  assert.equal(classify(msg({ headers: { "auto-submitted": "auto-replied" } }), band), "auto");
  assert.equal(classify(msg({ from: "no-reply@x.com" }), band), "auto");
  assert.equal(classify(msg({ headers: { "auto-submitted": "no" } }), band), "replied");
  assert.equal(classify(msg(), band), "replied");
});
