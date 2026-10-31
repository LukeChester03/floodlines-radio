import test from "node:test";
import assert from "node:assert/strict";
import { approveError } from "./sendlist.js";

const TOO_LONG = "Approving took too long. Check the Send list: some may already be approved, then try again.";
const SIGN_IN = "You're not signed in as the band account. Sign in again and retry.";
const CONNECTION = "Couldn't approve the list. Check your connection and try again.";

test("a timed-out approve says it took too long", () => {
  assert.equal(approveError({ code: "functions/deadline-exceeded" }), TOO_LONG);
});

test("an auth failure asks to sign in again", () => {
  assert.equal(approveError({ code: "functions/permission-denied" }), SIGN_IN);
  assert.equal(approveError({ code: "functions/unauthenticated" }), SIGN_IN);
});

test("anything else is a connection problem", () => {
  assert.equal(approveError(new Error("x")), CONNECTION);
  assert.equal(approveError(undefined), CONNECTION);
});
