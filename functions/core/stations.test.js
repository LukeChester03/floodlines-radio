import test from "node:test";
import assert from "node:assert/strict";
import { byPriority, reachable } from "./stations.js";
import { sendPace } from "./pace.js";

const st = (o = {}) => ({ route: "email", genreFit: "indie", rec: { dnc: false }, ...o });

test("reachable: email/indie/not dnc is true", () => assert.equal(reachable(st()), true));
test("reachable: route none or contact is false", () => {
  assert.equal(reachable(st({ route: "none" })), false);
  assert.equal(reachable(st({ route: "contact" })), false);
});
test("reachable: genreFit other is false", () => assert.equal(reachable(st({ genreFit: "other" })), false));
test("reachable: dnc is false", () => assert.equal(reachable(st({ rec: { dnc: true } })), false));
test("sendPace", () => assert.deepEqual(sendPace, { perRun: 50, perDay: 50 }));

test("byPriority: higher score first, unscored last, ties by rank", () => {
  const rows = [{ id: "a", score: null, rank: 1 }, { id: "b", score: 60, rank: 3 }, { id: "c", score: 80, rank: 2 }, { id: "d", score: 60, rank: 1 }];
  assert.deepEqual(rows.sort(byPriority).map(r => r.id), ["c", "d", "b", "a"]);
});
