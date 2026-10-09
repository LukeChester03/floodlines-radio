import test from "node:test";
import assert from "node:assert/strict";
import { gmailBanner } from "./gmail.js";

const addr = "floodlinesbanduk@gmail.com";

test("no status, or an empty one, is not connected", () => {
  assert.equal(gmailBanner(undefined).kind, "not-connected");
  assert.equal(gmailBanner({}).kind, "not-connected");
});

test("connected and healthy names the address", () => {
  const b = gmailBanner({ connected: addr, needsReconnect: false });
  assert.equal(b.kind, "connected");
  assert.match(b.text, /floodlinesbanduk@gmail\.com/);
});

test("needsReconnect says sending is paused", () => {
  const b = gmailBanner({ connected: addr, needsReconnect: true });
  assert.equal(b.kind, "reconnect");
  assert.match(b.text, /paused/i);
});
