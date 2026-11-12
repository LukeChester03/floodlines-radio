import test, { after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createServer } from "vite";

// The real station sheet, compiled by Vite and rendered into jsdom
const { window } = new JSDOM("<!doctype html>", { url: "http://localhost/", pretendToBeVisual: true });
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
Object.assign(globalThis, { window, document: window.document, localStorage: window.localStorage, HTMLElement: window.HTMLElement, SVGElement: window.SVGElement, Element: window.Element, Node: window.Node, requestAnimationFrame: window.requestAnimationFrame, cancelAnimationFrame: window.cancelAnimationFrame, getComputedStyle: window.getComputedStyle, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });

const vite = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true, hmr: false, ws: false } });
const { createElement, act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { default: StationSheet } = await vite.ssrLoadModule("/src/views/StationSheet.jsx");

let unmount = () => {};
afterEach(async () => { await act(async () => unmount()); document.body.innerHTML = ""; });
after(async () => { window.close(); await vite.close(); });

const song = { id: "s1", title: "Companion", color: "#8E3B6B" };
const station = { id: "r", name: "Radio A", country: "GB", region: "Leeds", type: "community", route: "email", genreFit: "indie", tier: "strong", score: 60, chance: 3, value: 3, reasons: [], rec: { tags: [], notes: "", starred: false, dnc: false, songs: {} }, per: { s1: { status: "new" } }, cur: { status: "new" } };

test("A ranked station's Priority row explains how Priority works", async () => {
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  unmount = () => root.unmount();
  const props = { id: "r", stations: [station], songs: [song], song, updateStation() {}, setStatus() {}, openMailer() {}, onClose() {} };
  await act(async () => root.render(createElement(StationSheet, props)));
  const dt = [...document.querySelectorAll(".facts dt")].find(d => d.textContent.startsWith("Priority"));
  const btn = dt?.parentElement.querySelector('button[aria-label="How Priority works"]');
  assert.ok(btn, "no help button in the Priority row");
  await act(async () => btn.dispatchEvent(new window.MouseEvent("click", { bubbles: true })));
  const text = document.querySelector('[role="region"][aria-label="How Priority works"]').textContent;
  for (const s of ["chance × 12 + value × 8", "Start here", "Strong", "Worth a go", "Long shot"]) assert.ok(text.includes(s), s);
});
