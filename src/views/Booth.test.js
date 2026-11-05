import test, { after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createServer } from "vite";

// The real Booth, compiled by Vite and rendered into jsdom; cloud.js and firebase.js are swapped for stubs
const { window } = new JSDOM("<!doctype html>", { url: "http://localhost/", pretendToBeVisual: true });
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
Object.assign(globalThis, { window, document: window.document, HTMLElement: window.HTMLElement, SVGElement: window.SVGElement, Element: window.Element, Node: window.Node, requestAnimationFrame: window.requestAnimationFrame, cancelAnimationFrame: window.cancelAnimationFrame, getComputedStyle: window.getComputedStyle, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });

const stubs = {
  "/src/cloud.js": "export const exportAll = () => ({});",
  "/src/firebase.js": "export const auth = {}; export const db = {}; export const functions = {}; export const storage = {};",
};
const vite = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: "custom",
  logLevel: "error",
  plugins: [{ name: "stubs", enforce: "pre", load: id => stubs[Object.keys(stubs).find(k => id.split("?")[0].endsWith(k))] }],
});
const { createElement, act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { default: Booth } = await vite.ssrLoadModule("/src/views/Booth.jsx");

const roots = [];
after(async () => {
  await act(async () => roots.forEach(r => r.unmount()));
  window.close();
  await vite.close();
});

const DAY = 864e5;
const daysAhead = n => new Date(Date.now() + n * DAY).toISOString().slice(0, 10);
const song = { id: "tide", title: "Tide" };

const station = (status, songs = {}) => ({
  id: "demon", name: "Demon FM", route: "email", rank: 1, country: "GB", region: "Leicester", reasons: [],
  cur: { status, queued: false }, per: { tide: { status } }, rec: { songs, notes: "", tags: [], dnc: false },
});
const pitched13DaysAgo = { tide: { status: "pitched", log: [{ at: new Date(Date.now() - 13 * DAY).toISOString(), type: "pitch" }] } };

const booth = async ({ stations = [station("new")], gigs = [], festivals = [], setView = () => {} } = {}) => {
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  roots.push(root);
  await act(async () => root.render(createElement(Booth, {
    stations, songs: [song], song, followups: { due: [] }, queue: [], openMailer() {}, openSheet() {}, setView, cloud: { gigs, festivals }, user: { email: "band@x.com" },
  })));
  return host;
};
const inOrder = (text, parts) => {
  const at = parts.map(p => text.indexOf(p));
  assert.ok(at.every(i => i >= 0), `missing one of ${parts} in ${text}`);
  assert.deepEqual(at, [...at].sort((a, b) => a - b));
};
const sectionHeads = host => [...host.querySelectorAll("h3")].map(h => h.textContent);

test("a new account sees the stats, then the intro, then On the go, then Pitch", async () => {
  const host = await booth();
  inOrder(host.textContent, ["Follow-ups due", "Your one place for every radio station", "On the go", "Pitch Tide here next"]);
});

test("with a pitched song there's no intro and the stats still come first", async () => {
  const host = await booth({ stations: [station("pitched", pitched13DaysAgo)] });
  assert.equal(host.querySelector(".intro-strip"), null);
  inOrder(host.textContent, ["Follow-ups due", "On the go"]);
});

test("one interested gig shows a Gigs heading with its count and no other sections", async () => {
  const host = await booth({ gigs: [{ id: "g", venue: "The Brudenell", date: daysAhead(5), decision: "interested" }] });
  assert.deepEqual(sectionHeads(host), ["Gigs 1"]);
});

test("with nothing to chase, the empty message shows and no section headings", async () => {
  const host = await booth();
  assert.match(host.textContent, /Nothing on the go\. Mark a gig or festival interested, or pitch a station\./);
  assert.deepEqual(sectionHeads(host), []);
});

test("a gig's card reads action, then name, then timing", async () => {
  const date = daysAhead(5);
  const host = await booth({ gigs: [{ id: "g", venue: "The Brudenell", date, decision: "interested" }] });
  const card = host.querySelector(".pursuit");
  inOrder(card.textContent, ["Apply", "The Brudenell", "In 5 days"]);
  assert.equal(card.querySelector("time").getAttribute("datetime"), date);
});

test("an overdue station card says so in words and carries the overdue class", async () => {
  const host = await booth({ stations: [station("pitched", pitched13DaysAgo)] });
  const card = host.querySelector(".pursuit");
  inOrder(card.textContent, ["Follow up", "Demon FM", "3 days overdue"]);
  assert.ok(card.classList.contains("overdue"));
});

test("a card with no date says so, with no time element", async () => {
  const host = await booth({ festivals: [{ id: "f", name: "Sent Fest", decision: "applied" }] });
  const card = host.querySelector(".pursuit");
  assert.match(card.textContent, /No date/);
  assert.equal(card.querySelector("time"), null);
});

test("pressing a station card opens Follow-ups", async () => {
  const views = [];
  const host = await booth({ stations: [station("pitched", pitched13DaysAgo)], setView: v => views.push(v) });
  await act(async () => host.querySelector(".pursuit").click());
  assert.deepEqual(views, ["followups"]);
});
