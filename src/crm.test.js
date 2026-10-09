import test from "node:test";
import assert from "node:assert/strict";
import { canGoLive, releaseBatch } from "./crm.js";
import { templates } from "./songs.js";

const song = { id: "s1", title: "Tidal Lines", link: "https://x.test/s1", released: "2026-01-01", blurb: "" };
const per = (status = "new", queued = false) => ({ s1: { status, queued } });
const st = (id, o = {}) => ({ id, name: `Radio ${id}`, show: "", route: "email", genreFit: "indie", email: `${id}@r.test`, rec: {}, per: per(), ...o });
const opts = { template: templates.pitch, signoff: "Luke", includeOthers: true };

test("releaseBatch queues only the station that fits and is still new", () => {
  const stations = [
    st("a"),
    st("b", { rec: { dnc: true } }),
    st("c", { per: per("pitched") }),
    st("d", { email: "" }),
    st("e", { rec: { bounced: "2026-02-01" } }),
  ];
  const out = releaseBatch(song, stations, [song], opts);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, "a");
  assert.equal(out[0].to, "a@r.test");
  assert.equal(out[0].state, "review");
  assert.equal(out[0].kind, "pitch");
  assert.equal(out[0].song, "s1");
  assert.ok(out[0].subject && out[0].body.includes("Tidal Lines"));
});

test("releaseBatch is a no-op when already queued", () => {
  assert.deepEqual(releaseBatch(song, [st("a", { per: per("new", true) })], [song], opts), []);
});

test("canGoLive needs a link and a release date", () => {
  assert.equal(canGoLive({ ...song, link: "" }), false);
  assert.equal(canGoLive({ ...song, released: "" }), false);
  assert.equal(canGoLive(song), true);
});
