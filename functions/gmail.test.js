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

const sig = { html: "<b>Contact</b><br>", text: "Contact" };
const tree = (raw) => {
  const node = (s) => {
    const [head, ...rest] = s.split("\r\n\r\n");
    const body = rest.join("\r\n\r\n");
    const b = /boundary="([^"]+)"/.exec(head)?.[1];
    if (!b) return { head, data: Buffer.from(body, "base64") };
    return { head, parts: body.split(`--${b}`).slice(1, -1).map((p) => node(p.replace(/^\r\n/, ""))) };
  };
  return node(decode(raw));
};

test("a signature makes multipart/alternative with plain text and escaped html", () => {
  const t = tree(rawMessage({ ...base, body: "Hi & <b>\nbye", signature: sig }));
  assert.match(t.head, /Content-Type: multipart\/alternative/);
  const [text, html] = t.parts;
  assert.match(text.head, /text\/plain; charset=UTF-8/);
  assert.equal(text.data.toString(), "Hi & <b>\nbye\n\nContact");
  assert.match(html.head, /text\/html; charset=UTF-8/);
  assert.ok(html.data.toString().includes("Hi &amp; &lt;b&gt;<br>bye<br><br><b>Contact</b><br>"));
});

test("a signature with the logo puts the html and an inline image in multipart/related", () => {
  const signature = { html: '<img src="cid:logo@floodlines" alt="FloodLines">', text: "FloodLines – ✓" };
  const logo = { name: "fl.png", mimeType: "image/png", data: Buffer.from([1, 2, 3]) };
  const [text, related] = tree(rawMessage({ ...base, signature, logo })).parts;
  assert.equal(text.data.toString(), "Hello there\n\nFloodLines – ✓");
  assert.match(related.head, /multipart\/related/);
  const [html, img] = related.parts;
  assert.ok(html.data.toString().includes("cid:logo@floodlines"));
  assert.match(img.head, /Content-Type: image\/png/);
  assert.match(img.head, /Content-ID: <logo@floodlines>/);
  assert.match(img.head, /Content-Disposition: inline/);
  assert.deepEqual([...img.data], [1, 2, 3]);
});

test("a signature with attachments: multipart/mixed of the alternative then the file", () => {
  const t = tree(rawMessage({ ...base, signature: sig, attachments: [{ name: "EPK.pdf", mimeType: "application/pdf", data }] }));
  assert.match(t.head, /multipart\/mixed/);
  assert.equal(t.parts.length, 2);
  assert.match(t.parts[0].head, /multipart\/alternative/);
  assert.match(t.parts[1].head, /Content-Disposition: attachment/);
  assert.deepEqual(t.parts[1].data, data);
});
