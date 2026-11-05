import test, { after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createServer } from "vite";

// The real page, compiled by Vite and rendered into jsdom: its overlay portals to document.body
const { window } = new JSDOM("<!doctype html>", { url: "http://localhost/", pretendToBeVisual: true });
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
Object.assign(globalThis, { window, document: window.document, HTMLElement: window.HTMLElement, SVGElement: window.SVGElement, Element: window.Element, Node: window.Node, requestAnimationFrame: window.requestAnimationFrame, cancelAnimationFrame: window.cancelAnimationFrame, getComputedStyle: window.getComputedStyle, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });

const vite = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true, hmr: false, ws: false } });
const { createElement, act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { default: Festivals } = await vite.ssrLoadModule("/src/views/Festivals.jsx");

let unmount = () => {};
afterEach(async () => { await act(async () => unmount()); document.body.innerHTML = ""; });
after(async () => { window.close(); await vite.close(); });

const mount = async cloud => {
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  unmount = () => root.unmount();
  const rerender = next => act(async () => root.render(createElement(Festivals, { cloud: next })));
  await rerender(cloud);
  return { host, rerender };
};
const waiting = { id: "w", url: "https://waiting.example/", tier: null };
const page = async cloud => (await mount({ festivals: [waiting], ...cloud })).host.innerHTML;

const fest = { id: "f", url: "https://fest.example/", name: "Riverside Fest", tier: "long", pay: "£200" };
const stub = (festivals, more) => ({ festivals, decideFestival() {}, ...more });
const dialog = () => document.querySelector('[role="dialog"]');
const openButton = host => host.querySelector("li button:not([aria-pressed])");
const settle = () => act(async () => new Promise(r => setTimeout(r, 100)));
const closed = async () => { for (let i = 0; i < 50 && dialog(); i++) await settle(); assert.equal(dialog(), null); };
const inDialog = name => [...dialog().querySelectorAll("button")].find(b => b.textContent === name);
const click = el => act(async () => el.click());
const opened = async (festivals, more) => {
  const cloud = stub(festivals, more);
  const view = await mount(cloud);
  await click(openButton(view.host));
  return { ...view, cloud };
};

test("Being read shows what the last reading run did and lists what it couldn't read", async () => {
  const html = await page({ readingStatus: { at: "2026-11-04T14:30:00.000Z", read: 10, saved: 8, unread: ["https://a.example/"], waiting: 3 } });
  assert.match(html, /Last read [^<]*14:30[^<]*: 8 of 10 filled in/);
  assert.match(html, /Couldn't read these, check them by hand/);
  assert.match(html, /<li>.*https:\/\/a\.example\/.*<\/li>/);
  assert.doesNotMatch(html, /Not read yet/);
});

test("Being read shows the error of a failed run", async () => {
  const html = await page({ readingStatus: { at: "2026-11-04T14:30:00.000Z", read: 1, saved: 0, unread: [], waiting: 1, error: "Timed out after 10 minutes" } });
  assert.match(html, /Timed out after 10 minutes/);
  assert.doesNotMatch(html, /check them by hand/);
});

test("a search that saved nothing says why under the last-search line", async () => {
  const { host } = await mount({ festivals: [waiting], festivalStatus: { ranAt: "2026-11-02T09:00:00Z", found: 2, saved: 0, skipped: { known: 1, unreadable: 1 } } });
  const lines = [...host.querySelectorAll("p")].map(p => p.textContent);
  const last = lines.findIndex(l => l.startsWith("Last search"));
  assert.equal(lines[last + 1], "Found 2, none new: 1 already on your list, 1 couldn't be read");
});

test("before any run, Being read says the job may not be running", async () => {
  assert.match(await page({ readingStatus: null }), /Not read yet\. The reading job may not be running on the band's Mac\./);
});

test("a festival's open button shows a dialog named after it with its details", async () => {
  await opened([fest]);
  assert.equal(dialog().getAttribute("aria-label"), "Riverside Fest");
  assert.match(dialog().textContent, /£200/);
});

test("an empty detail has no row in the dialog", async () => {
  await opened([{ ...fest, pay: undefined, size: "500" }]);
  assert.match(dialog().textContent, /Size/);
  assert.doesNotMatch(dialog().textContent, /Pay/);
});

test("deciding in the dialog records it and keeps the dialog open", async () => {
  const calls = [];
  await opened([fest], { decideFestival: (...a) => calls.push(a) });
  await click(inDialog("Applied"));
  assert.deepEqual(calls, [["f", "applied"]]);
  await settle();
  assert.ok(dialog());
});

test("pressing the current decision in the dialog clears it", async () => {
  const calls = [];
  await opened([{ ...fest, decision: "applied" }], { decideFestival: (...a) => calls.push(a) });
  await click(inDialog("Applied"));
  assert.deepEqual(calls, [["f", null]]);
});

test("the dialog shows the festival as it changes", async () => {
  const { rerender, cloud } = await opened([{ ...fest, read: "Old read" }]);
  await rerender({ ...cloud, festivals: [{ ...fest, read: "New read" }] });
  assert.match(dialog().textContent, /New read/);
  assert.doesNotMatch(dialog().textContent, /Old read/);
});

test("the dialog stays open when the filter hides its festival", async () => {
  const { host } = await opened([fest]);
  await click(host.querySelector('[aria-label="Filter by decision"]').querySelectorAll("button")[3]);
  for (let i = 0; i < 20 && host.querySelector("li"); i++) await settle();
  assert.equal(host.querySelector("li"), null);
  assert.equal(dialog().getAttribute("aria-label"), "Riverside Fest");
});

test("the dialog closes when its festival is gone", async () => {
  const { rerender, cloud } = await opened([fest, { ...fest, id: "g" }]);
  await rerender({ ...cloud, festivals: [{ ...fest, id: "g" }] });
  await closed();
});

test("a festival still being read has no open button", async () => {
  const { host } = await mount(stub([waiting]));
  assert.ok(host.querySelector("li"));
  assert.equal(openButton(host), null);
});

test("Escape closes the dialog and returns focus to the card's open button", async () => {
  const { host } = await mount(stub([fest]));
  const button = openButton(host);
  button.focus();
  await click(button);
  await settle();
  await act(async () => window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" })));
  await closed();
  await settle();
  assert.equal(document.activeElement, button);
});
