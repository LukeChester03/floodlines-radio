import test from "node:test";
import assert from "node:assert/strict";
import { storageEpk } from "./epk.js";

const bucket = (f) => ({ file: (p) => (assert.equal(p, "epk/current"), f) });
const B = Buffer.from("pdf bytes");

test("no uploaded EPK reads as null", async () => {
  const f = { exists: async () => [false] };
  assert.equal(await storageEpk(bucket(f)).read(), null);
});

test("uploaded EPK reads as name, mimeType and bytes", async () => {
  const f = {
    exists: async () => [true],
    getMetadata: async () => [{ contentType: "application/pdf", metadata: { name: "FloodLines EPK.pdf" } }],
    download: async () => [B],
  };
  assert.deepEqual(await storageEpk(bucket(f)).read(), { name: "FloodLines EPK.pdf", mimeType: "application/pdf", data: B });
});

test("download errors propagate", async () => {
  const err = new Error("boom");
  const f = {
    exists: async () => [true],
    getMetadata: async () => [{ contentType: "application/pdf" }],
    download: async () => { throw err; },
  };
  await assert.rejects(storageEpk(bucket(f)).read(), err);
});
