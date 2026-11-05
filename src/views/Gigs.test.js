import test, { after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createServer } from "vite";

// The real page, compiled by Vite and rendered into jsdom: its Modal needs a document
const { window } = new JSDOM("<!doctype html>", { url: "http://localhost/", pretendToBeVisual: true });
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
Object.assign(globalThis, { window, document: window.document, HTMLElement: window.HTMLElement, SVGElement: window.SVGElement, Element: window.Element, Node: window.Node, requestAnimationFrame: window.requestAnimationFrame, cancelAnimationFrame: window.cancelAnimationFrame, getComputedStyle: window.getComputedStyle, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });

const vite = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true, hmr: false, ws: false } });
const { createElement, act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { default: Gigs } = await vite.ssrLoadModule("/src/views/Gigs.jsx");
after(async () => { window.close(); await vite.close(); });

test("with no gigs, the empty state is styled for the dark page", async () => {
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  await act(async () => root.render(createElement(Gigs, { cloud: { gigs: [], decideGig() {} } })));
  assert.equal(host.querySelector(".empty.on-dark .empty-title")?.textContent, "No gigs yet.");
  await act(async () => root.unmount());
});
