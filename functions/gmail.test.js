import test from "node:test";
import assert from "node:assert/strict";
import { rawMessage } from "./gmail.js";

const decode = (raw) => Buffer.from(raw, "base64url").toString("utf8");
const base = { from: "a@x.com", to: "b@y.com", subject: "Hi", body: "Hello there" };
const data = Buffer.from([0, 255, 1, 2, 3, 250, 128]);

test("no attachments, or an empty array, leaves the message unchanged", () => {
  assert.equal(rawMessage({ ...base, attachments: [] }), rawMessage(base));
  assert.ok(decode(rawMessage(base)).includes("Content-Type: text/plain; charset=UTF-8"));
});

function parts(raw) {
  const text = decode(raw);
  const boundary = /boundary="([^"]+)"/.exec(text)[1];
  return { text, parts: text.split(`--${boundary}`).slice(1, -1).map((p) => p.replace(/^\r\n/, "")) };
}

test("an attachment makes a multipart/mixed message with the body and the file", () => {
  const { text, parts: ps } = parts(rawMessage({ ...base, attachments: [{ name: "FloodLines EPK.pdf", mimeType: "application/pdf", data }] }));
  assert.match(text, /Content-Type: multipart\/mixed/);
  assert.equal(ps.length, 2);
  const [body, file] = ps.map((p) => p.split("\r\n\r\n"));
  assert.equal(Buffer.from(body[1], "base64").toString(), "Hello there");
  assert.match(file[0], /Content-Type: application\/pdf/);
  assert.match(file[0], /Content-Disposition: attachment; filename="FloodLines EPK.pdf"/);
  assert.deepEqual(Buffer.from(file[1], "base64"), data);
});

test("a non-ASCII filename is encoded and decodes back", () => {
  const name = "Presse – EPK.pdf";
  const { text } = parts(rawMessage({ ...base, attachments: [{ name, mimeType: "application/pdf", data }] }));
  const star = /filename\*=UTF-8''([^\s;]+)/.exec(text)[1];
  assert.equal(decodeURIComponent(star), name);
  assert.ok(!/[^\x00-\x7f]/.test(text.split("\r\n\r\n")[0]));
});
