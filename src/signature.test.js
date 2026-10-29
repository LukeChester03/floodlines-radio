import test from "node:test";
import assert from "node:assert/strict";
import { renderSignature, signatureSetting } from "./signature.js";

test("bold heading and a mailto link", () => {
  const r = renderSignature("**Contact**\n[Mail us](mailto:a@b.c)", {});
  assert.equal(r.html, '<b>Contact</b><br><a href="mailto:a@b.c">Mail us</a><br>');
  assert.equal(r.text, "Contact\nMail us");
});

test("an https link reads as text: url in plain text", () => {
  assert.equal(renderSignature("[Spotify](https://open.spotify.com/x)", {}).text, "Spotify: https://open.spotify.com/x");
});

test("an unsafe scheme is shown as its escaped source, unlinked", () => {
  const { html } = renderSignature("[bad](javascript:alert(1))", {});
  assert.doesNotMatch(html, /<a|href/);
  assert.equal(html, "[bad](javascript:alert(1))<br>");
});

test("other text is html-escaped", () => {
  assert.equal(renderSignature("Tom & <Jerry>", {}).html, "Tom &amp; &lt;Jerry&gt;<br>");
});

test("{logo} becomes the logo img only when a src is given, and never appears in text", () => {
  const withLogo = renderSignature("A\n{logo}\nB", { logoSrc: "cid:logo@floodlines" });
  assert.match(withLogo.html, /<img src="cid:logo@floodlines" alt="FloodLines"/);
  const without = renderSignature("A\n{logo}\nB", {});
  assert.doesNotMatch(without.html, /<img/);
  assert.equal(withLogo.text, "A\nB");
  assert.equal(without.text, "A\nB");
});

test("runs of blank lines collapse to one in text", () => {
  assert.equal(renderSignature("A\n\n\n\nB", {}).text, "A\n\nB");
});

test("the saved setting is null when empty, else source with the cid-logo html", () => {
  assert.equal(signatureSetting(""), null);
  assert.equal(signatureSetting("  \n "), null);
  const s = signatureSetting("Hi\n{logo}");
  assert.equal(s.source, "Hi\n{logo}");
  assert.equal(s.html, 'Hi<br><img src="cid:logo@floodlines" alt="FloodLines" style="max-width:240px"><br>');
  assert.equal(s.text, "Hi");
});
