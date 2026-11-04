import test from "node:test";
import assert from "node:assert/strict";
import { canGoLive, checkEpkFile, checkLogoFile, epkRecord, logoRecord, followupBadge, followupsByStation, knownSends, releaseBatch, replyGroups, songInfo, withSentLog, withTemplate } from "./crm.js";
import { fill, templates } from "./songs.js";

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

test("checkLogoFile accepts a PNG up to 200 KB and rejects bigger files or other types", () => {
  assert.equal(checkLogoFile({ size: 150_000, type: "image/png" }), null);
  assert.equal(checkLogoFile({ size: 250_000, type: "image/png" }), "The logo must be 200 KB or smaller.");
  assert.equal(checkLogoFile({ size: 1000, type: "image/svg+xml" }), "Use a PNG, JPEG or GIF image.");
});

test("logoRecord describes the logo for settings, with base64 data and no data: prefix", () => {
  assert.deepEqual(logoRecord({ name: "fl.png", size: 3, type: "image/png" }, "AAEC", new Date("2026-10-29T12:00:00Z")),
    { name: "fl.png", mimeType: "image/png", data: "AAEC", size: 3, updatedAt: "2026-10-29T12:00:00.000Z" });
});

const finalFear = { id: "final-fear", title: "Final Fear" };
const companion = { id: "companion", title: "Companion" };
const bothSongs = [finalFear, companion];
const pitchedOn = (at, status = "pitched") => ({ status, log: [{ at, type: "pitch", text: "Pitched" }] });
const stationRow = (id, songRecs, now, rec = {}) => ({
  id, name: `Radio ${id}`, rec,
  per: Object.fromEntries(bothSongs.map(sg => [sg.id, songInfo(songRecs[sg.id], now)])),
});
const NOV_4 = new Date("2026-11-04T12:00:00Z").getTime();

test("followupsByStation puts two songs pitched the same day on one upcoming row", () => {
  const row = stationRow("a", { "final-fear": pitchedOn("2026-11-03T09:00:00Z"), companion: pitchedOn("2026-11-03T09:00:00Z") }, NOV_4);
  const { due, upcoming } = followupsByStation([row], bothSongs);
  assert.deepEqual(due, []);
  assert.equal(upcoming.length, 1);
  assert.equal(upcoming[0].station, row);
  assert.deepEqual(upcoming[0].songs.map(x => x.song.id), ["final-fear", "companion"]);
  assert.equal(upcoming[0].due.toISOString(), "2026-11-13T09:00:00.000Z");
});

test("followupsByStation splits a station between due and upcoming by song", () => {
  const row = stationRow("a", { companion: pitchedOn("2026-10-20T09:00:00Z"), "final-fear": pitchedOn("2026-10-28T09:00:00Z") }, NOV_4);
  const { due, upcoming } = followupsByStation([row], bothSongs);
  assert.deepEqual(due.map(g => [g.station.id, g.songs.map(x => x.song.id)]), [["a", ["companion"]]]);
  assert.deepEqual(upcoming.map(g => [g.station.id, g.songs.map(x => x.song.id)]), [["a", ["final-fear"]]]);
  assert.equal(upcoming[0].due.toISOString(), "2026-11-07T09:00:00.000Z");
});

test("followupsByStation leaves out do-not-contact stations", () => {
  const recs = { companion: pitchedOn("2026-10-20T09:00:00Z"), "final-fear": pitchedOn("2026-11-03T09:00:00Z") };
  assert.deepEqual(followupsByStation([stationRow("a", recs, NOV_4, { dnc: true })], bothSongs), { due: [], upcoming: [] });
});

test("followupsByStation leaves out replied and played songs", () => {
  const recs = { companion: pitchedOn("2026-10-20T09:00:00Z", "replied"), "final-fear": pitchedOn("2026-11-03T09:00:00Z", "played") };
  assert.deepEqual(followupsByStation([stationRow("a", recs, NOV_4)], bothSongs), { due: [], upcoming: [] });
});

test("followupsByStation sorts groups by earliest due and carries each song's contact details", () => {
  const later = stationRow("later", { companion: pitchedOn("2026-10-22T09:00:00Z") }, NOV_4);
  const sooner = stationRow("sooner", { companion: pitchedOn("2026-10-20T09:00:00Z"), "final-fear": pitchedOn("2026-10-21T09:00:00Z") }, NOV_4);
  const { due } = followupsByStation([later, sooner], bothSongs);
  assert.deepEqual(due.map(g => g.station.id), ["sooner", "later"]);
  assert.equal(due[0].due.toISOString(), "2026-10-30T09:00:00.000Z");
  const c = due[0].songs.find(x => x.song.id === "companion");
  assert.equal(c.lastAt.toISOString(), "2026-10-20T09:00:00.000Z");
  assert.equal(c.followUps, 0);
  assert.equal(c.status, "pitched");
});

test("the Follow-ups badge counts one station due for two songs once", () => {
  const row = stationRow("a", { companion: pitchedOn("2026-10-20T09:00:00Z"), "final-fear": pitchedOn("2026-10-20T09:00:00Z") }, NOV_4);
  assert.equal(followupBadge(followupsByStation([row], bothSongs).due.length, []), 1);
});

const ff = { id: "finalfear", title: "Final Fear", link: "https://x.test/ff", blurb: "Debut." };
const co = { id: "companion", title: "Companion", link: "https://x.test/co", blurb: "Second." };
const station = { name: "Radio A" };

test("fill names two songs, and lists each link on its own line", () => {
  const { subject, body } = fill(templates.followup, station, [ff, co], [ff, co]);
  assert.match(subject, /Final Fear and Companion$/);
  assert.match(body, /"Final Fear and Companion"/);
  assert.match(body, /\nFinal Fear: https:\/\/x\.test\/ff\nCompanion: https:\/\/x\.test\/co\n/);
});

test("fill reads three songs as A, B and C, skips a missing link and uses the first blurb", () => {
  const list = [ff, { id: "c", title: "Cold", blurb: "Third." }, co];
  const { body } = fill({ subject: "", body: "{song}|{songBlurb}|{songLink}" }, station, list, list);
  assert.equal(body, "Final Fear, Cold and Companion|Debut.|\nFinal Fear: https://x.test/ff\nCompanion: https://x.test/co");
});

test("fill leaves out every listed song from the other songs line", () => {
  const other = { id: "o", title: "Other", link: "https://x.test/o", released: "2026-01-01" };
  const list = [ff, co].map(s => ({ ...s, released: "2026-01-01" }));
  const { body } = fill({ subject: "", body: "{otherSongs}" }, station, list, [...list, other]);
  assert.equal(body, '\nAlso from us: "Other" https://x.test/o\n');
});

test("fill with one song object reads as it always has", () => {
  assert.deepEqual(fill(templates.followup, station, ff, [ff, co]), {
    subject: "Re: Music submission: FloodLines – Final Fear",
    body: `Hi Radio A team,\n\nJust following up on "Final Fear" by FloodLines, which I sent over recently, in case it got buried. Here it is again: https://x.test/ff\n\nHope you enjoy it, and thanks for your time.\n\nLuke\nFloodLines`,
  });
});

test("a follow-up record with songs logs a follow-up on each song", () => {
  const sentAt = "2026-11-01T09:00:00Z";
  const pitch = { status: "pitched", log: [{ at: "2026-10-01T09:00:00Z", type: "pitch" }] };
  const crm = { a: { songs: { finalfear: pitch, companion: pitch } } };
  const out = withSentLog(crm, [{ id: "a", song: "finalfear", songs: ["finalfear", "companion"], kind: "followup", subject: "Re", sentAt }]);
  for (const id of ["finalfear", "companion"]) {
    const rec = out.a.songs[id];
    assert.equal(rec.status, "followed");
    assert.ok(rec.log.some(l => l.type === "followup" && l.at === sentAt));
    assert.equal(songInfo(rec).followUps, 1);
  }
});
