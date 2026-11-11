import test, { after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createServer } from "vite";

// The real table, compiled by Vite and rendered into jsdom
const { window } = new JSDOM("<!doctype html>", { url: "http://localhost/", pretendToBeVisual: true });
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
Object.assign(globalThis, { window, document: window.document, localStorage: window.localStorage, HTMLElement: window.HTMLElement, SVGElement: window.SVGElement, Element: window.Element, Node: window.Node, requestAnimationFrame: window.requestAnimationFrame, cancelAnimationFrame: window.cancelAnimationFrame, getComputedStyle: window.getComputedStyle, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });

const vite = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true, hmr: false, ws: false } });
const { createElement, act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { default: StationsTable } = await vite.ssrLoadModule("/src/views/StationsTable.jsx");

let unmount = () => {};
afterEach(async () => { await act(async () => unmount()); document.body.innerHTML = ""; window.localStorage.clear(); });
after(async () => { window.close(); await vite.close(); });

const song = { id: "s1", title: "Companion", color: "#8E3B6B" };
const row = (id, name, extra) => {
  const cur = { status: "new", queued: false, isDue: false, lastAt: null };
  return { id, name, country: "GB", region: "Leeds", group: "uk", type: "community", route: "email", genreFit: "indie", tier: "strong", rank: 1, score: 50, chance: 3, value: 3, rec: { tags: [], notes: "", starred: false, dnc: false }, per: { s1: cur }, cur, ...extra };
};
const radio = row("r", "Radio A");
const playlist = (extra) => row("p", "Indie Gems", { type: "playlist", platform: "spotify", followers: 12000, ...extra });

const render = async (stations, kind) => {
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  unmount = () => root.unmount();
  const props = { stations, songs: [song], song, selected: [], setSelected() {}, openSheet() {}, openMailer() {}, setStatus() {}, updateStation() {}, ...(kind && { kind }) };
  await act(async () => root.render(createElement(StationsTable, props)));
  return host;
};
const headings = host => [...host.querySelectorAll("thead th")].map(th => th.textContent);
const cell = (host, label) => host.querySelector(`tbody td[data-label="${label}"]`)?.textContent;

test("The playlist table lists playlists and not radio", async () => {
  const host = await render([radio, playlist()], "playlist");
  assert.match(host.innerHTML, /Indie Gems/);
  assert.doesNotMatch(host.innerHTML, /Radio A/);
});

test("The radio table lists radio and not playlists, with or without kind", async () => {
  for (const kind of [undefined, "radio"]) {
    const host = await render([radio, playlist()], kind);
    assert.match(host.innerHTML, /Radio A/);
    assert.doesNotMatch(host.innerHTML, /Indie Gems/);
    await act(async () => unmount());
  }
});

test("The playlist table shows platform and followers", async () => {
  const host = await render([playlist()], "playlist");
  assert.equal(cell(host, "Platform"), "Spotify");
  assert.equal(cell(host, "Followers"), "12,000");
});

test("Unknown followers show a dash", async () => {
  const host = await render([playlist({ followers: null })], "playlist");
  assert.equal(cell(host, "Followers"), "—");
});

test("The radio table has no Platform or Followers column", async () => {
  const h = headings(await render([radio, playlist()], "radio"));
  assert.ok(!h.some(t => /Platform|Followers/.test(t)), h.join(" | "));
});

test("The playlist table with no playlists says so", async () => {
  const host = await render([radio], "playlist");
  assert.match(host.querySelector(".empty").textContent, /playlists/);
});
