import test, { after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createServer } from "vite";

// Real renders of the Send list and App. Vite compiles the JSX; cloud.js and firebase.js are swapped for stubs.
const { window } = new JSDOM("<!doctype html><div id=root></div>", { url: "http://localhost/#sendlist", pretendToBeVisual: true });
window.scrollTo = () => {};
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
Object.assign(globalThis, { window, document: window.document, location: window.location, localStorage: window.localStorage, HTMLElement: window.HTMLElement, SVGElement: window.SVGElement, Element: window.Element, Node: window.Node, requestAnimationFrame: window.requestAnimationFrame, cancelAnimationFrame: window.cancelAnimationFrame, getComputedStyle: window.getComputedStyle, IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });

const stubs = {
  "/src/cloud.js": "export const useCloud = () => globalThis.stubCloud; export const connectGmailUrl = ''; export const localData = () => null; export const importLocal = async () => {}; export const exportAll = () => ({});",
  "/src/firebase.js": "export const auth = {}; export const db = {}; export const functions = {}; export const storage = {};",
};
const vite = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: "custom",
  logLevel: "error",
  plugins: [{ name: "stubs", enforce: "pre", load: id => stubs[Object.keys(stubs).find(k => id.split("?")[0].endsWith(k))] }],
});
const roots = [];
after(async () => {
  await act(async () => roots.forEach(r => r.unmount()));
  window.close();
  await vite.close();
});

const { createElement, act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { default: SendList } = await vite.ssrLoadModule("/src/views/SendList.jsx");
const { default: App } = await vite.ssrLoadModule("/src/App.jsx");

const render = async element => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  await act(async () => root.render(element));
  return host;
};
const button = (host, name) => [...host.querySelectorAll("button")].find(b => b.textContent.includes(name));
const stubCloud = queue => ({ ready: true, songs: [{ id: "finalfear", title: "Final Fear", color: "red" }], crm: {}, queue, sends: [], replies: [], gigs: [], festivals: [], settings: { templates: {}, signoff: "", includeOthers: true }, gmail: {}, updateStation() {}, removeFromQueue() {} });
const whole = { _key: "demon-fm-gb:finalfear:pitch", id: "demon-fm-gb", song: "finalfear", kind: "pitch", state: "review" };
const sendList = (items, cloud, logEvent = () => {}) => createElement(SendList, { items, cloud, songs: [], logEvent, openMailer() {}, setView() {} });

test("Remove deletes a row with no station, song or kind by its document id", async () => {
  const removed = [];
  const logged = [];
  const host = await render(sendList([{ _key: "demon-fm-gb:finalfear:pitch", state: "sent" }], { sends: [], removeFromQueue: keys => removed.push(keys) }, (...a) => logged.push(a)));
  await act(async () => button(host, "Remove").click());
  assert.deepEqual(removed, [["demon-fm-gb:finalfear:pitch"]]);
  assert.deepEqual(logged, []);
});

test("a row with no station or song shows but can't be approved or counted", async () => {
  const host = await render(sendList([{ _key: "ghost" }, whole], { sends: [] }));
  assert.equal(host.querySelectorAll(".sl-list > li").length, 2);
  assert.match(button(host, "Approve").textContent, /\(1\)/);
  assert.equal([...host.querySelectorAll("button")].filter(b => b.textContent === "Edit").length, 1);
});

const badges = async queue => {
  globalThis.stubCloud = stubCloud(queue);
  const host = await render(createElement(App, { user: { email: "band@x.com" } }));
  return { nav: button(host, "Send list").querySelector(".nav-badge")?.textContent, onAir: host.querySelector(".onair-n")?.textContent };
};

test("a sent shell shows on neither badge", async () => {
  assert.deepEqual(await badges([{ _key: "ghost", state: "sent" }]), { nav: undefined, onAir: undefined });
});

test("a broken row with no state shows on neither badge", async () => {
  assert.deepEqual(await badges([{ _key: "ghost" }]), { nav: undefined, onAir: undefined });
});

test("a waiting entry shows on both badges", async () => {
  assert.deepEqual(await badges([whole, { _key: "ghost", state: "sent" }]), { nav: "1", onAir: "1 to send" });
});
