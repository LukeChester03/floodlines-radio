import test from "node:test";
import assert from "node:assert/strict";
import { canGoLive, checkEpkFile, epkRecord, followupBadge, knownSends, releaseBatch, replyGroups, withSentLog, withTemplate } from "./crm.js";
import { templates } from "./songs.js";

const song = { id: "s1", title: "Tidal Lines", link: "https://x.test/s1", released: "2026-01-01", blurb: "" };
const per = (status = "new", queued = false) => ({ s1: { status, queued } });
const st = (id, o = {}) => ({ id, name: `Radio ${id}`, show: "", route: "email", genreFit: "indie", email: `${id}@r.test`, rec: {}, per: per(), ...o });
const opts = { template: templates.pitch, signoff: "Luke", includeOthers: true };

test("releaseBatch queues only the station that fits and is still new", () => {
  const stations = [
    st("a"),
    st("b", { rec: { dnc: true } }),
    st("c", { per: per("pitched") }),
    st("d", { email: "" }),
    st("e", { rec: { bounced: "2026-02-01" } }),
  ];
  const out = releaseBatch(song, stations, [song], opts);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, "a");
  assert.equal(out[0].to, "a@r.test");
  assert.equal(out[0].state, "review");
  assert.equal(out[0].kind, "pitch");
  assert.equal(out[0].song, "s1");
  assert.ok(out[0].subject && out[0].body.includes("Tidal Lines"));
});

test("releaseBatch is a no-op when already queued", () => {
  assert.deepEqual(releaseBatch(song, [st("a", { per: per("new", true) })], [song], opts), []);
});

test("canGoLive needs a link and a release date", () => {
  assert.equal(canGoLive({ ...song, link: "" }), false);
  assert.equal(canGoLive({ ...song, released: "" }), false);
  assert.equal(canGoLive(song), true);
});

const sentAt = "2026-06-01T10:00:00Z";
const send = { id: "s1", song: "companion", kind: "pitch", subject: "Hi", sentAt };

test("a Firestore send record flips the station to pitched with a log line", () => {
  const crm = withSentLog({}, knownSends([], [send]));
  assert.equal(crm.s1.songs.companion.status, "pitched");
  assert.equal(crm.s1.songs.companion.log[0].text, "Pitched: Hi");
});

test("a send in both the sent-log and Firestore is counted once", () => {
  const known = knownSends([send], [{ ...send }]);
  assert.equal(known.length, 1);
  assert.equal(withSentLog({}, known).s1.songs.companion.log.length, 1);
});

test("the sent-log and a later Firestore send for the same key are both kept", () => {
  assert.equal(knownSends([send], [{ ...send, sentAt: "2026-06-09T10:00:00Z" }]).length, 2);
});

const rep = (id, o = {}) => ({ id, stationId: "s1", song: "s1", outcome: "replied", decision: "undecided", date: "2026-10-02T09:00:00Z", ...o });

test("replyGroups splits replies into undecided, want-reply and done, newest first", () => {
  const g = replyGroups([
    rep("a", { date: "2026-10-02T09:00:00Z" }),
    rep("b", { date: "2026-10-05T09:00:00Z" }),
    rep("c", { decision: "want-reply" }),
    rep("d", { decision: "no-action" }),
    rep("e", { outcome: "auto" }),
  ]);
  assert.deepEqual(g.undecided.map(r => r.id), ["b", "a"]);
  assert.deepEqual(g.wantReply.map(r => r.id), ["c"]);
  assert.deepEqual(g.done.map(r => r.id).sort(), ["d", "e"]);
});

test("a replied-done reply is in done, and an auto-reply the band moved is not", () => {
  const g = replyGroups([rep("a", { decision: "replied-done" }), rep("b", { outcome: "auto", decision: "want-reply" })]);
  assert.deepEqual(g.done.map(r => r.id), ["a"]);
  assert.deepEqual(g.wantReply.map(r => r.id), ["b"]);
});

test("the Follow-ups badge is due follow-ups plus undecided replies", () => {
  assert.equal(followupBadge(3, [rep("a"), rep("b", { decision: "no-action" }), rep("c", { outcome: "auto" })]), 4);
});

test("withTemplate patches one template and leaves the other alone", () => {
  const t = { pitch: { subject: "P", body: "pb" }, followup: { subject: "F", body: "fb" } };
  assert.deepEqual(withTemplate(t, "pitch", { subject: "New" }), { pitch: { subject: "New", body: "pb" }, followup: t.followup });
});

test("withTemplate reset restores the original from songs.js", () => {
  const t = { pitch: { subject: "P", body: "pb" }, followup: { subject: "F", body: "fb" } };
  assert.deepEqual(withTemplate(t, "followup", "reset"), { pitch: t.pitch, followup: templates.followup });
});

test("checkEpkFile rejects files over 18 MB and accepts a 2 MB PDF", () => {
  const MB = 1024 * 1024;
  assert.equal(checkEpkFile({ name: "e.pdf", size: 19 * MB, type: "application/pdf" }), "The EPK must be 18 MB or smaller.");
  assert.equal(checkEpkFile({ name: "e.pdf", size: 2 * MB, type: "application/pdf" }), null);
});

test("checkEpkFile rejects types other than PDF, ZIP or Word", () => {
  assert.equal(checkEpkFile({ name: "e.exe", size: 100, type: "application/x-msdownload" }), "Upload a PDF, ZIP or Word file.");
});

test("epkRecord describes the uploaded file for settings", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  assert.deepEqual(epkRecord({ name: "FloodLines EPK.pdf", size: 2048, type: "application/pdf" }, now),
    { path: "epk/current", name: "FloodLines EPK.pdf", size: 2048, contentType: "application/pdf", uploadedAt: now.toISOString() });
});
