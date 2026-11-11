import test, { after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createServer } from "vite";

// The real Pipeline, compiled by Vite and rendered into jsdom
const { window } = new JSDOM("<!doctype html>", { url: "http://localhost/", pretendToBeVisual: true });
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
Object.assign(globalThis, { window, document: window.document, HTMLElement: window.HTMLElement, SVGElement: window.SVGElement, Element: window.Element, Node: window.Node, requestAnimationFrame: window.requestAnimationFrame, cancelAnimationFrame: window.cancelAnimationFrame, getComputedStyle: window.getComputedStyle, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });

const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom", logLevel: "error" });
const { createElement, act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { default: Pipeline } = await vite.ssrLoadModule("/src/views/Pipeline.jsx");

const roots = [];
after(async () => {
  await act(async () => roots.forEach(r => r.unmount()));
  window.close();
  await vite.close();
});

const song = { id: "tide", title: "Tide" };
const row = (id, name, type) => ({
  id, name, type, show: "", route: "email", genreFit: "indie", rank: 1, country: "GB", region: "Leeds",
  cur: { status: "pitched", queued: false, isDue: false }, rec: { songs: {}, notes: "", tags: [], dnc: false },
});

const pipeline = async stations => {
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  roots.push(root);
  await act(async () => root.render(createElement(Pipeline, { stations, song, setStatus() {}, openSheet() {} })));
  return host;
};
const card = (host, name) => [...host.querySelectorAll(".kcard")].find(c => c.querySelector("b")?.textContent.startsWith(name));

test("A pitched playlist's card shows the Playlist label; a radio station's card doesn't", async () => {
  const host = await pipeline([row("p", "Indie Gems", "playlist"), row("r", "Demon FM", "community")]);
  assert.equal(card(host, "Indie Gems").querySelector(".kind-tag")?.textContent, "Playlist");
  assert.equal(card(host, "Demon FM").querySelector(".kind-tag"), null);
});
