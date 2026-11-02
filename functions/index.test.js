import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

const installed = existsSync(new URL("./node_modules/firebase-functions", import.meta.url));

test("backend entry point exports every deployed function", { skip: !installed && "run npm ci in functions/ first" }, async () => {
  const mod = await import("./index.js");
  assert.deepEqual(Object.keys(mod).sort(), [
    "addFestival", "addGig", "connectGmail", "connectGmailCallback", "mailRound", "sendPitch",
  ]);
});
