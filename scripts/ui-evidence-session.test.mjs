import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { storageState } from "./ui-evidence-session.mjs";

const script = new URL("./ui-evidence-session.mjs", import.meta.url).pathname;
const run = (env) => spawnSync(process.execPath, [script], { env: { PATH: process.env.PATH, ...env }, encoding: "utf8" });

test("storageState puts the user under the Firebase auth key for the base URL", () => {
  const s = storageState("http://127.0.0.1:5173", "KEY", { uid: "u1", email: "test@test.com" });
  assert.deepEqual(s.cookies, []);
  assert.equal(s.origins.length, 1);
  assert.equal(s.origins[0].origin, "http://127.0.0.1:5173");
  assert.equal(s.origins[0].localStorage.length, 1);
  assert.equal(s.origins[0].localStorage[0].name, "firebase:authUser:KEY:[DEFAULT]");
  assert.deepEqual(JSON.parse(s.origins[0].localStorage[0].value), { uid: "u1", email: "test@test.com" });
});

test("storageState drops a trailing slash from the base URL", () => {
  assert.equal(storageState("http://127.0.0.1:5173/", "KEY", {}).origins[0].origin, "http://127.0.0.1:5173");
});

test("missing credentials file: exits non-zero, nothing on stdout, says what to create", () => {
  const r = run({ UI_EVIDENCE_BASE_URL: "http://127.0.0.1:5173", TEST_LOGIN_ENV: join(tmpdir(), "no-such-dir", "test-login.env") });
  assert.notEqual(r.status, 0);
  assert.equal(r.stdout, "");
  for (const s of ["test-login.env", "TEST_EMAIL", "TEST_PASSWORD"]) assert.match(r.stderr, new RegExp(s));
});

test("credentials file without TEST_PASSWORD: exits non-zero naming it", () => {
  const file = join(mkdtempSync(join(tmpdir(), "ui-evidence-")), "test-login.env");
  writeFileSync(file, "TEST_EMAIL=test@test.com\n");
  const r = run({ UI_EVIDENCE_BASE_URL: "http://127.0.0.1:5173", TEST_LOGIN_ENV: file });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /TEST_PASSWORD/);
});

test("missing UI_EVIDENCE_BASE_URL: exits non-zero naming it", () => {
  const r = run({});
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /UI_EVIDENCE_BASE_URL/);
});
