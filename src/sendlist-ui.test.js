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

test("Edit on a multi-song follow-up keeps its songs", async () => {
  const calls = [];
  const entry = { _key: "a:finalfear:followup", id: "a", song: "finalfear", songs: ["finalfear", "companion"], kind: "followup", subject: "S", body: "B", state: "review" };
  const host = await render(createElement(SendList, { items: [entry], cloud: { sends: [] }, songs: [], logEvent() {}, openMailer: (...a) => calls.push(a), setView() {} }));
  await act(async () => button(host, "Edit").click());
  assert.deepEqual(calls, [[["a"], "followup", "finalfear", { a: { subject: "S", body: "B" } }, { a: ["finalfear", "companion"] }]]);
});

test("Draft follow-ups queues one email per station, naming each station's due songs", async () => {
  const pitched = { status: "pitched", log: [{ at: "2026-01-05T09:00:00Z", type: "pitch", text: "Pitched" }] };
  const [both, one] = ["deal-radio-gb", "demon-fm-gb"];
  const crm = { [both]: { songs: { finalfear: pitched, companion: pitched } }, [one]: { songs: { companion: pitched } } };
  const queued = [];
  const saved = [];
  globalThis.stubCloud = {
    ...stubCloud([]), crm,
    songs: [{ id: "finalfear", title: "Final Fear", color: "red", link: "https://x.test/ff" }, { id: "companion", title: "Companion", color: "red", link: "https://x.test/co" }],
    addToQueue: items => queued.push(...items),
    updateStation: (id, patch) => saved.push([id, patch(crm[id])]),
  };
  window.history.replaceState(null, "", "#followups");
  const host = await render(createElement(App, { user: { email: "band@x.com" } }));
  window.history.replaceState(null, "", "#sendlist");
  await act(async () => button(host, "Draft follow-ups").click());
  await act(async () => button(document.body, "to the send list").click());

  const mine = id => queued.filter(q => q.id === id);
  assert.equal(mine(both).length, 1);
  const [entry] = mine(both);
  assert.equal(entry.kind, "followup");
  assert.equal(entry.song, "finalfear");
  assert.deepEqual(entry.songs, ["finalfear", "companion"]);
  assert.match(entry.body, /"Final Fear and Companion"/);

  const [single] = mine(one);
  assert.equal(single.song, "companion");
  assert.deepEqual(single.songs, ["companion"]);
  assert.match(single.body, /Here it is again: https:\/\/x\.test\/co\n/);

  const logged = saved.filter(([id]) => id === both).flatMap(([, p]) => Object.entries(p.songs).filter(([, r]) => r.log.at(-1).text === "Follow-up added to the send list").map(([sid]) => sid));
  assert.deepEqual(logged.sort(), ["companion", "finalfear"]);
});

test("a merged follow-up stays queued when its first song had an earlier nudge, and goes once it's sent", async () => {
  const removed = [];
  const entry = { _key: "demon-fm-gb:companion:followup", id: "demon-fm-gb", song: "companion", songs: ["companion", "finalfear"], kind: "followup", state: "review", addedAt: "2026-11-27T09:00:00Z" };
  const nudge = { id: "demon-fm-gb", song: "companion", kind: "followup", subject: "Re", sentAt: "2026-11-13T10:00:00Z" };
  const mount = async sends => {
    globalThis.stubCloud = { ...stubCloud([entry]), sends, removeFromQueue: keys => removed.push(keys) };
    const host = await render(createElement(App, { user: { email: "band@x.com" } }));
    return button(host, "Send list").querySelector(".nav-badge")?.textContent;
  };

  assert.equal(await mount([nudge]), "1");
  assert.deepEqual(removed, []);

  assert.equal(await mount([nudge, { ...nudge, songs: entry.songs, sentAt: "2026-11-27T10:00:00Z" }]), undefined);
  assert.deepEqual(removed, [[entry._key]]);
});

// Real stations from the list: one Email, one form with an address, one uploader
const [email, form, uploader] = ["demon-fm-gb", "idobi-radio-us", "bbc-introducing-gb"];
const overdue = { songs: { finalfear: { status: "pitched", log: [{ at: "2026-01-05T09:00:00Z", type: "pitch", text: "Pitched" }] } } };
const openApp = async (hash, cloud) => {
  globalThis.stubCloud = { ...stubCloud([]), ...cloud };
  window.history.replaceState(null, "", hash);
  const host = await render(createElement(App, { user: { email: "band@x.com" } }));
  window.history.replaceState(null, "", "#sendlist");
  return host;
};

test("Draft follow-ups only queues the Email station", async () => {
  const queued = [];
  const crm = { [email]: overdue, [form]: overdue, [uploader]: overdue };
  const host = await openApp("#followups", { crm, addToQueue: items => queued.push(...items) });
  await act(async () => button(host, "Draft follow-ups").click());
  // An earlier test's dialog can still be animating out, so take the newest
  const add = [...document.body.querySelectorAll("button")].filter(b => b.textContent.includes("to the send list")).at(-1);
  assert.match(add.textContent, /Add 1 follow-up/);
  await act(async () => add.click());
  assert.deepEqual(queued.map(q => q.id), [email]);
});

test("a form station past the wait puts no badge on Follow-ups", async () => {
  const host = await openApp("#sendlist", { crm: { [form]: overdue } });
  assert.equal(button(host, "Follow-ups").querySelector(".nav-badge")?.textContent, undefined);
});

test("the Booth counts and lists a follow-up for the Email station only", async () => {
  const host = await openApp("#booth", { crm: { [email]: overdue, [form]: overdue } });
  const cue = [...host.querySelectorAll("button")].find(b => b.textContent.includes("Follow-ups due"));
  assert.equal(cue.querySelector(".cue-n").textContent, "1");
  const chasing = [...host.querySelectorAll(".pursuit")].filter(p => p.querySelector(".pursuit-action").textContent === "Follow up");
  assert.equal(chasing.length, 1);
  assert.match(chasing[0].textContent, /Demon/i);
});
