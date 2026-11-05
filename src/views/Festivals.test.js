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

const picked = { ...fest, topPick: true, topReasons: ["Open form"] };
const inDays = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

test("a closed card shows the name, where and when, and leaves the rest to the dialog", async () => {
  await mount(stub([{ ...fest, where: "Leeds", when: "June 2027" }]));
  const text = document.body.textContent;
  assert.match(text, /Riverside Fest/);
  assert.match(text, /Leeds/);
  assert.match(text, /June 2027/);
  assert.doesNotMatch(text, /£200/);
});

test("a card has no decision buttons and the filter chips stay", async () => {
  const { host } = await mount(stub([fest]));
  assert.equal(host.querySelectorAll("li [aria-pressed]").length, 0);
  assert.equal(host.querySelectorAll("li a").length, 0);
  assert.ok(host.querySelectorAll('[aria-label="Filter by decision"] button').length > 0);
});

test("a card shows the decision made", async () => {
  const { host } = await mount(stub([{ ...fest, decision: "applied" }]));
  assert.match(host.querySelector("li").textContent, /Applied/);
});

test("an undecided card shows no decision", async () => {
  const { host } = await mount(stub([fest]));
  assert.doesNotMatch(host.querySelector("li").textContent, /Interested|Applied|Booked|Passed/);
});

test("a top pick closing within 14 days shows both tags on its card", async () => {
  const { host } = await mount(stub([{ ...picked, applyBy: inDays(5) }]));
  const card = host.querySelector("li").textContent;
  assert.match(card, /Top pick/);
  assert.match(card, /Closing soon/);
});

test("top-pick reasons show only once the dialog is open", async () => {
  const { host } = await mount(stub([picked]));
  assert.doesNotMatch(document.body.textContent, /Open form/);
  await click(openButton(host));
  assert.match(dialog().textContent, /Open form/);
});

test("a festival still being read keeps its link, note and hint", async () => {
  const { host } = await mount(stub([{ ...waiting, note: "Saw this on a poster" }]));
  const card = host.querySelector("li").textContent;
  assert.match(card, /https:\/\/waiting\.example\//);
  assert.match(card, /Saw this on a poster/);
  assert.match(card, /Details fill in by themselves/);
});
