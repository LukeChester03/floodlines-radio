import test from "node:test";
import assert from "node:assert/strict";
import { reachable } from "./stations.js";
import { sendPace } from "./pace.js";

const st = (o = {}) => ({ route: "email", genreFit: "indie", rec: { dnc: false }, ...o });

test("reachable: email/indie/not dnc is true", () => assert.equal(reachable(st()), true));
test("reachable: route none or contact is false", () => {
  assert.equal(reachable(st({ route: "none" })), false);
  assert.equal(reachable(st({ route: "contact" })), false);
});
test("reachable: genreFit other is false", () => assert.equal(reachable(st({ genreFit: "other" })), false));
test("reachable: dnc is false", () => assert.equal(reachable(st({ rec: { dnc: true } })), false));
test("sendPace", () => assert.deepEqual(sendPace, { perRun: 5, perDay: 50 }));
