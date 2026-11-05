import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { followupsByStation, songInfo } from "../crm.js";

const finalFear = { id: "final-fear", title: "Final Fear", color: "#123456" };
const companion = { id: "companion", title: "Companion", color: "#654321" };
const songs = [finalFear, companion];
const NOV_4 = new Date("2026-11-04T12:00:00Z").getTime();
const pitched = at => ({ status: "pitched", log: [{ at, type: "pitch", text: "Pitched" }] });
const row = (id, recs, o = {}) => ({
  id, name: `Radio ${id}`, show: "", country: "GB", region: "Leeds", email: `${id}@r.test`, rec: { songs: {}, tags: [], notes: "" },
  per: Object.fromEntries(songs.map(sg => [sg.id, songInfo(recs[sg.id], NOV_4)])), ...o,
});
const bothOn = at => ({ "final-fear": pitched(at), companion: pitched(at) });
const count = (html, text) => html.split(text).length - 1;

let vite, Followups, Booth;
before(async () => {
  vite = await createServer({ server: { middlewareMode: true, ws: false }, appType: "custom", logLevel: "error" });
  Followups = (await vite.ssrLoadModule("/src/views/Followups.jsx")).default;
  Booth = (await vite.ssrLoadModule("/src/views/Booth.jsx")).default;
});
after(() => vite.close());

const props = (stations, o = {}) => ({
  stations, songs, followups: followupsByStation(stations, songs), byId: {}, cloud: { replies: [], decideReply() {} },
  openMailer() {}, openSheet() {}, setStatus() {}, ...o,
});
const html = (stations, o) => renderToStaticMarkup(createElement(Followups, props(stations, o)));

// The rendered tree, so a test can press a button the way the screen would
const elements = node => (Array.isArray(node) ? node.flatMap(elements) : node?.props ? [node, ...elements(node.props.children)] : []);
const button = (tree, label) => elements(tree).find(e => e.type === "button" && [e.props.children].flat().join("").startsWith(label));

test("Coming up shows one row per station with a chip per song", () => {
  const out = html(["a", "b", "c"].map(id => row(id, bothOn("2026-11-03T09:00:00Z"))));
  const list = out.slice(out.indexOf("Coming up"));
  assert.equal(count(list, "<li"), 3);
  assert.equal(count(list, 'class="sent-chip"'), 6);
  assert.equal(count(list, "Due 13 Nov"), 3);
  assert.equal(count(list, "Pitched 3 Nov"), 3);
});

test("Empty state names the next date when something is coming up", () => {
  assert.match(html([row("a", bothOn("2026-11-03T09:00:00Z"))]), /Nothing due yet\. Next follow-ups from 13 Nov\./);
});

test("Empty state keeps its text when nothing is scheduled", () => {
  const out = html([row("a", {})]);
  assert.match(out, /No follow-ups due\./);
  assert.match(out, /Nothing scheduled yet\./);
});

test("Due now is one panel listing a station once, with a chip per due song", () => {
  const out = html([row("a", bothOn("2026-10-20T09:00:00Z")), row("b", { companion: pitched("2026-10-20T09:00:00Z") })]);
  const panel = out.slice(0, out.indexOf("Coming up"));
  assert.equal(count(panel, "Due now"), 1);
  assert.equal(count(panel, "<li"), 2);
  assert.equal(count(panel, 'class="sent-chip"'), 3);
  assert.equal(count(panel, "Last contact 20 Oct"), 2);
  assert.equal(count(panel, "Nudge 1 of 2"), 2);
});

test("One draft button opens the mailer with each due station's songs", () => {
  const calls = [];
  const stations = [row("a", bothOn("2026-10-20T09:00:00Z")), row("b", { companion: pitched("2026-10-20T09:00:00Z") })];
  const tree = Followups(props(stations, { openMailer: (...args) => calls.push(args) }));
  button(tree, "Draft follow-ups (2)").props.onClick();
  assert.deepEqual(calls, [[["a", "b"], "followup", undefined, undefined, { a: ["final-fear", "companion"], b: ["companion"] }]]);
});

test("They replied marks every song on the row as replied", () => {
  const calls = [];
  const tree = Followups(props([row("a", bothOn("2026-10-20T09:00:00Z"))], { setStatus: (...args) => calls.push(args) }));
  button(tree, "They replied").props.onClick();
  assert.deepEqual(calls, [[["a"], "replied", "final-fear"], [["a"], "replied", "companion"]]);
});

test("Time to move on stays per song", () => {
  const nudged = { status: "followed", log: [{ at: "2026-09-01T09:00:00Z", type: "pitch" }, { at: "2026-09-11T09:00:00Z", type: "followup" }, { at: "2026-09-25T09:00:00Z", type: "followup" }] };
  assert.match(html([row("a", { companion: nudged, "final-fear": nudged })]), /Mark all 2 as passed/);
});

test("The Booth counts stations due, not songs", () => {
  const stations = [row("a", bothOn("2026-10-20T09:00:00Z"), { rank: 1, reasons: [], route: "email", cur: { status: "pitched" } })];
  const out = renderToStaticMarkup(createElement(Booth, {
    stations, songs, song: companion, followups: followupsByStation(stations, songs), queue: [], cloud: { gigs: [], festivals: [] }, user: { email: "x@y.test" },
    openMailer() {}, openSheet() {}, setView() {},
  }));
  assert.match(out, /<span class="cue-n">1<\/span><span class="cue-label">Follow-ups due<\/span>/);
});
