import test from "node:test";
import assert from "node:assert/strict";
import { fill, templates } from "./songs.js";

const song = { id: "s", title: "Final Fear", link: "" };
const pitch = row => fill(templates.pitch, row, song, []).body;

test("a playlist pitch names it as a playlist", () => {
  assert.match(pitch({ name: "Indie Gems", type: "playlist", show: null }), /for Indie Gems playlist\./);
});

test("a playlist already called a playlist isn't doubled", () => {
  const body = pitch({ name: "The Indie Playlist", type: "playlist" });
  assert.match(body, /for The Indie Playlist\./);
  assert.doesNotMatch(body, /Playlist playlist/i);
});

test("a radio show still reads show on station", () => {
  assert.match(pitch({ name: "Demon FM", type: "community", show: "Indie Hour" }), /for Indie Hour on Demon FM\./);
});

test("the status tag reads Added for a played playlist, and its usual label otherwise", async t => {
  const { JSDOM } = await import("jsdom");
  const { createServer } = await import("vite");
  const { window } = new JSDOM("<!doctype html>");
  Object.assign(globalThis, { window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true });
  const vite = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom", logLevel: "error" });
  t.after(() => vite.close());
  const { createElement, act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { StatusTag } = await vite.ssrLoadModule("/src/ui/bits.jsx");
  const label = async props => {
    const host = document.createElement("div");
    const root = createRoot(host);
    await act(async () => root.render(createElement(StatusTag, props)));
    const text = host.textContent;
    await act(async () => root.unmount());
    return text;
  };
  assert.equal(await label({ status: "played", type: "playlist" }), "Added");
  assert.equal(await label({ status: "played", type: "community" }), "Played");
  assert.equal(await label({ status: "played" }), "Played");
  assert.equal(await label({ status: "pitched", type: "playlist" }), "Pitched");
});
