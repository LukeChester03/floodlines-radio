import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

// The real page, compiled by Vite and rendered to HTML
const vite = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true, hmr: false, ws: false } });
after(() => vite.close());
const { default: Festivals } = await vite.ssrLoadModule("/src/views/Festivals.jsx");

const waiting = { id: "w", url: "https://waiting.example/", tier: null };
const page = cloud => renderToStaticMarkup(createElement(Festivals, { cloud: { festivals: [waiting], ...cloud } }));

test("Being read shows what the last reading run did and lists what it couldn't read", () => {
  const html = page({ readingStatus: { at: "2026-11-04T14:30:00.000Z", read: 10, saved: 8, unread: ["https://a.example/"], waiting: 3 } });
  assert.match(html, /Last read [^<]*14:30[^<]*: 8 of 10 filled in/);
  assert.match(html, /Couldn(&#x27;|')t read these, check them by hand/);
  assert.match(html, /<li>.*https:\/\/a\.example\/.*<\/li>/);
  assert.doesNotMatch(html, /Not read yet/);
});

test("Being read shows the error of a failed run", () => {
  const html = page({ readingStatus: { at: "2026-11-04T14:30:00.000Z", read: 1, saved: 0, unread: [], waiting: 1, error: "Timed out after 10 minutes" } });
  assert.match(html, /Timed out after 10 minutes/);
  assert.doesNotMatch(html, /check them by hand/);
});

test("before any run, Being read says the job may not be running", () => {
  assert.match(page({ readingStatus: null }), /Not read yet\. The reading job may not be running on the band(&#x27;|')s Mac\./);
});
