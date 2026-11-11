import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { followupBadge, followupsByStation, songInfo } from "../crm.js";

const finalFear = { id: "final-fear", title: "Final Fear", color: "#123456" };
const companion = { id: "companion", title: "Companion", color: "#654321" };
const songs = [finalFear, companion];
const NOV_4 = new Date("2026-11-04T12:00:00Z").getTime();
const pitched = at => ({ status: "pitched", log: [{ at, type: "pitch", text: "Pitched" }] });
const row = (id, recs, o = {}) => ({
  id, name: `Radio ${id}`, show: "", country: "GB", region: "Leeds", email: `${id}@r.test`, route: "email", rec: { songs: {}, tags: [], notes: "" },
  per: Object.fromEntries(songs.map(sg => [sg.id, songInfo(recs[sg.id], NOV_4, o.route || "email")])), ...o,
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

const TRACKED = "Applied by hand";
const emailPart = out => out.slice(0, out.indexOf(TRACKED));
const trackedPart = out => out.slice(out.indexOf(TRACKED));
const uploader = (id = "up") => row(id, { companion: pitched("2026-10-01T09:00:00Z") }, { route: "platform" });

test("A pitched uploader past the wait shows in the tracking section, not in Due now or Coming up", () => {
  const out = html([uploader()]);
  assert.equal(count(emailPart(out), "Radio up"), 0);
  assert.equal(count(trackedPart(out), "Radio up"), 1);
  assert.match(trackedPart(out), /Uploader/);
  assert.match(trackedPart(out), /Companion/);
  assert.match(trackedPart(out), /Pitched/);
  assert.match(trackedPart(out), /Applied 1 Oct/);
});

test("A tracked station with no date shows no applied date", () => {
  const out = html([row("a", { companion: { status: "played", log: [] } }, { route: "form" })]);
  assert.match(trackedPart(out), /Radio a/);
  assert.doesNotMatch(trackedPart(out), /Applied \d/);
});

test("The tracking section says no email goes to these stations", () => {
  assert.match(trackedPart(html([uploader()])), /No email goes to these stations/);
});

test("The email part says these stations get an email, sent once approved", () => {
  const part = emailPart(html([row("a", bothOn("2026-10-20T09:00:00Z"))]));
  assert.match(part, /These stations get an email/);
  assert.match(part, /once you approve it on the Send list/);
});

test("Pressing a tracked station's name opens its sheet", () => {
  const calls = [];
  const tree = Followups(props([uploader()], { openSheet: id => calls.push(id) }));
  button(tree, "Radio up").props.onClick();
  assert.deepEqual(calls, ["up"]);
});

test("The tracking section still shows, with its empty message, when nothing was applied by hand", () => {
  assert.match(trackedPart(html([row("a", {})])), /Nothing applied by hand yet/);
});

test("Tracked stations don't feed the Follow-ups badge", () => {
  const { followups } = props([uploader("a"), uploader("b")]);
  assert.equal(followupBadge(followups.due.length, []), 0);
});

test("The Booth counts stations due, not songs", () => {
  const stations = [row("a", bothOn("2026-10-20T09:00:00Z"), { rank: 1, reasons: [], route: "email", cur: { status: "pitched" } })];
  const out = renderToStaticMarkup(createElement(Booth, {
    stations, songs, song: companion, followups: followupsByStation(stations, songs), queue: [], sends: [], cloud: { gigs: [], festivals: [] }, user: { email: "x@y.test" },
    openMailer() {}, openSheet() {}, setView() {},
  }));
  assert.match(out, /<span class="cue-n">1<\/span><span class="cue-label">Follow-ups due<\/span>/);
});

// A playlist and a radio station side by side; only the playlist carries the label
const LABEL = ">Playlist</span>";
const linePart = (out, name) => out.slice(out.indexOf(name), out.indexOf("</li>", out.indexOf(name)));

test("An Email playlist pitched 11 days ago is Due now with the Playlist label; a radio station in the same state has none", () => {
  const recs = { companion: pitched("2026-10-24T09:00:00Z") };
  const out = html([row("p", recs, { type: "playlist" }), row("r", recs, { type: "community" })]);
  const panel = out.slice(0, out.indexOf("Coming up"));
  assert.match(linePart(panel, "Radio p"), new RegExp(LABEL));
  assert.doesNotMatch(linePart(panel, "Radio r"), new RegExp(LABEL));
});

test("A playlist coming up carries the Playlist label", () => {
  const out = html([row("p", { companion: pitched("2026-11-03T09:00:00Z") }, { type: "playlist" })]);
  assert.match(linePart(out.slice(out.indexOf("Coming up")), "Radio p"), new RegExp(LABEL));
});

test("A form playlist marked Pitched is applied by hand with the Playlist label, and not Due now", () => {
  const out = html([row("p", { companion: pitched("2026-10-24T09:00:00Z") }, { type: "playlist", route: "form" })]);
  assert.equal(count(emailPart(out), "Radio p"), 0);
  assert.match(linePart(trackedPart(out), "Radio p"), new RegExp(LABEL));
});
