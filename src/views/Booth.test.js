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
const { weeklySends } = await vite.ssrLoadModule("/src/pursuits.js");

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
  cur: { status, queued: false }, per: { tide: { status }, "final-fear": { status }, companion: { status } }, rec: { songs, notes: "", tags: [], dnc: false },
});
const pitched13DaysAgo = { tide: { status: "pitched", log: [{ at: new Date(Date.now() - 13 * DAY).toISOString(), type: "pitch" }] } };

const booth = async ({ stations = [station("new")], songs = [song], gigs = [], festivals = [], sends = [], setView = () => {} } = {}) => {
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  roots.push(root);
  await act(async () => root.render(createElement(Booth, {
    stations, songs, song, sends, followups: { due: [] }, queue: [], openMailer() {}, openSheet() {}, setView, cloud: { gigs, festivals }, user: { email: "band@x.com" },
  })));
  return host;
};
const inOrder = (text, parts) => {
  const at = parts.map(p => text.indexOf(p));
  assert.ok(at.every(i => i >= 0), `missing one of ${parts} in ${text}`);
  assert.deepEqual(at, [...at].sort((a, b) => a - b));
};
const sectionHeads = host => [...host.querySelectorAll(".pursuit-section h3")].map(h => h.textContent);

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

const finalFear = { id: "final-fear", title: "Final Fear" };
const companion = { id: "companion", title: "Companion" };
const pitchedBoth = { "final-fear": pitched13DaysAgo.tide, companion: pitched13DaysAgo.tide };

test("a station with two songs waiting gets one card naming both", async () => {
  const host = await booth({ stations: [station("pitched", pitchedBoth)], songs: [finalFear, companion] });
  const cards = host.querySelectorAll(".pursuit");
  assert.equal(cards.length, 1);
  assert.match(cards[0].textContent, /Demon FM for Final Fear and Companion/);
});

const gigsDue = n => Array.from({ length: n }, (_, i) => ({ id: `g${i}`, venue: `Venue ${i + 1}`, date: daysAhead(i + 1), decision: "interested" }));
const festivalsApplied = n => Array.from({ length: n }, (_, i) => ({ id: `f${i}`, name: `Fest ${i + 1}`, decision: "applied" }));
const stationsDue = n => Array.from({ length: n }, (_, i) => ({ ...station("pitched", pitchedBoth), id: `s${i}`, name: `Radio ${i + 1}` }));
const section = (host, title) => [...host.querySelectorAll(".pursuit-section")].find(s => s.querySelector("h3").textContent.startsWith(title));
const cardsIn = el => [...el.querySelectorAll(".pursuit")];
const seeAll = el => [...el.querySelectorAll("button")].find(b => b.textContent.startsWith("See all"));

test("five gigs show five cards and no See all", async () => {
  const gigs = section(await booth({ gigs: gigsDue(5) }), "Gigs");
  assert.equal(cardsIn(gigs).length, 5);
  assert.equal(seeAll(gigs), undefined);
});

test("six gigs show the soonest five, See all 6, and a count of 6", async () => {
  const host = await booth({ gigs: gigsDue(6) });
  const gigs = section(host, "Gigs");
  assert.deepEqual(cardsIn(gigs).map(c => c.textContent.match(/Venue \d/)[0]), ["Venue 1", "Venue 2", "Venue 3", "Venue 4", "Venue 5"]);
  assert.equal(seeAll(gigs).textContent, "See all 6");
  assert.deepEqual(sectionHeads(host), ["Gigs 6"]);
});

test("the limit is per section", async () => {
  const host = await booth({ gigs: gigsDue(6), festivals: festivalsApplied(2) });
  assert.equal(cardsIn(section(host, "Gigs")).length, 5);
  assert.equal(seeAll(section(host, "Gigs")).textContent, "See all 6");
  assert.equal(cardsIn(section(host, "Festivals")).length, 2);
  assert.equal(seeAll(section(host, "Festivals")), undefined);
});

test("See all counts stations, not songs", async () => {
  const host = await booth({ stations: stationsDue(6), songs: [finalFear, companion] });
  assert.equal(seeAll(section(host, "Stations")).textContent, "See all 6");
});

test("See all opens each section's page", async () => {
  const views = [];
  const host = await booth({ gigs: gigsDue(6), festivals: festivalsApplied(6), stations: stationsDue(6), songs: [finalFear, companion], setView: v => views.push(v) });
  for (const title of ["Gigs", "Festivals", "Stations"]) await act(async () => seeAll(section(host, title)).click());
  assert.deepEqual(views, ["gigs", "festivals", "followups"]);
});

const going = host => [...host.querySelectorAll("h2")].find(h => h.textContent === "How it's going").closest("section");
const levelsIn = el => Object.fromEntries([...el.querySelectorAll(".level")].map(r => [r.querySelector(".level-label").textContent, Number(r.querySelector(".level-n").textContent)]));
const songRow = (el, title) => [...el.querySelectorAll("h4")].find(h => h.textContent === title).closest("li");
const tideAndCompanion = (id, tide, comp) => ({ ...station(tide), id, per: { tide: { status: tide }, companion: { status: comp } } });
const twoSongs = {
  songs: [song, companion],
  stations: [tideAndCompanion("a", "played", "new"), tideAndCompanion("b", "replied", "pitched"), tideAndCompanion("c", "new", "new")],
};

test("How it's going sits between On the go and Pitch", async () => {
  inOrder((await booth()).textContent, ["On the go", "How it's going", "Pitch Tide here next"]);
});

test("Campaign levels sits inside How it's going, once, with its four rows", async () => {
  const host = await booth(twoSongs);
  const heading = [...host.querySelectorAll("h2, h3")].filter(h => h.textContent === "Tide: campaign levels");
  assert.equal(heading.length, 1);
  assert.ok(going(host).contains(heading[0]));
  assert.deepEqual(levelsIn(heading[0].parentElement), { "Can apply": 3, Contacted: 2, Replied: 2, Played: 1 });
});

test("How it's going still shows with nothing on the go", async () => {
  const host = await booth();
  assert.match(host.textContent, /Nothing on the go/);
  assert.ok(going(host));
});

test("each song shows its title with its contacted, replied and played numbers", async () => {
  const section = going(await booth(twoSongs));
  assert.deepEqual(levelsIn(songRow(section, "Tide")), { Contacted: 2, Replied: 2, Played: 1 });
  assert.deepEqual(levelsIn(songRow(section, "Companion")), { Contacted: 1, Replied: 0, Played: 0 });
});

test("songs show in the order they're given", async () => {
  const section = going(await booth({ ...twoSongs, songs: [companion, song] }));
  assert.deepEqual([...section.querySelectorAll("h4")].map(h => h.textContent), ["Companion", "Tide"]);
});

test("the current song's numbers match between the two charts", async () => {
  const host = await booth(twoSongs);
  const heading = [...going(host).querySelectorAll("h3")].find(h => h.textContent === "Tide: campaign levels");
  const { "Can apply": _, ...levels } = levelsIn(heading.parentElement);
  assert.deepEqual(levelsIn(songRow(going(host), "Tide")), levels);
});

const sendsAgo = (days, n = 1) => Array.from({ length: n }, (_, i) => ({ id: `s${days}-${i}`, song: "tide", kind: "pitch", sentAt: new Date(Date.now() - days * DAY).toISOString() }));
const textsOf = (el, selector) => [...el.querySelectorAll(selector)].map(x => x.textContent);

test("the Emails sent chart shows all 8 week labels and each week's count", async () => {
  const sends = [...sendsAgo(0, 3), ...sendsAgo(7)];
  const section = going(await booth({ sends }));
  assert.ok(textsOf(section, "h3").includes("Emails sent"));
  assert.deepEqual(textsOf(section, ".week-label"), weeklySends(sends, Date.now()).map(w => w.label));
  assert.deepEqual(textsOf(section, ".week-n"), ["0", "0", "0", "0", "0", "0", "1", "3"]);
});

test("with nothing sent in the 8 weeks, a message shows instead of the chart", async () => {
  const section = going(await booth({ sends: sendsAgo(70) }));
  assert.match(section.textContent, /No emails sent in the last 8 weeks\./);
  assert.deepEqual(textsOf(section, ".week-label"), []);
});

const cardFor = (host, sel, name) => [...host.querySelectorAll(`.next-card${sel}`)].find(c => c.textContent.includes(name));

test("a playlist due a follow-up shows the Playlist label in On the go; a radio station due one doesn't", async () => {
  const host = await booth({ stations: [
    { ...station("pitched", pitched13DaysAgo), id: "gems", name: "Indie Gems", type: "playlist" },
    { ...station("pitched", pitched13DaysAgo), type: "community" },
  ] });
  assert.equal(cardFor(host, ".pursuit", "Indie Gems").querySelector(".kind-tag")?.textContent, "Playlist");
  assert.equal(cardFor(host, ".pursuit", "Demon FM").querySelector(".kind-tag"), null);
});

test("a playlist in Pitch here next shows the Playlist label; a radio station doesn't", async () => {
  const host = await booth({ stations: [{ ...station("new"), id: "gems", name: "Indie Gems", type: "playlist" }, { ...station("new"), type: "community" }] });
  assert.equal(cardFor(host, ":not(.pursuit)", "Indie Gems").querySelector(".kind-tag")?.textContent, "Playlist");
  assert.equal(cardFor(host, ":not(.pursuit)", "Demon FM").querySelector(".kind-tag"), null);
});
