import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = new URL("./merge.mjs", import.meta.url).pathname;

const row = (o) => ({ country: "GB", region: "", url: `https://example.com/${o.name}`, method: "platform", email: null, emailAllowed: false, formUrl: null, paid: false, instructions: "", fit: "medium", sourceUrl: null, notes: null, ...o });

function merge(radio, playlists) {
  const dir = mkdtempSync(join(tmpdir(), "merge-"));
  for (const d of ["research", "scripts", "src/data", "functions/data"]) mkdirSync(join(dir, d), { recursive: true });
  writeFileSync(join(dir, "scripts/overrides.json"), "{}");
  writeFileSync(join(dir, "research/radio.json"), JSON.stringify(radio));
  if (playlists) {
    mkdirSync(join(dir, "research/playlists"));
    writeFileSync(join(dir, "research/playlists/p.json"), JSON.stringify(playlists));
  }
  try { execFileSync("node", [SCRIPT], { cwd: dir, stdio: "pipe" }); } catch (e) { e.dir = dir; throw e; }
  return {
    stations: JSON.parse(readFileSync(join(dir, "src/data/stations.json"), "utf8")),
    emails: JSON.parse(readFileSync(join(dir, "functions/data/station-emails.json"), "utf8")),
  };
}

const radio = [
  row({ name: "Fen Radio", type: "community", region: "Cambridgeshire" }),
  row({ name: "BBC Radio Derby", type: "regional", region: "Derby" }),
];

test("playlist row comes out typed, categorised, scored and in the email list", () => {
  const { stations, emails } = merge(radio, [
    row({ name: "Indie Gems", type: "radio", platform: "spotify", followers: 12000, method: "email", email: "gems@example.com", emailAllowed: true }),
  ]);
  const p = stations.find(s => s.name === "Indie Gems");
  assert.equal(p.type, "playlist");
  assert.equal(p.platform, "spotify");
  assert.equal(p.followers, 12000);
  assert.equal(p.route, "email");
  assert.equal(p.category, "playlist-spotify");
  assert.equal(typeof p.score, "number");
  assert.deepEqual(emails.find(e => e.id === p.id), { id: p.id, email: "gems@example.com" });
});

test("followers set provisional value", () => {
  const { stations } = merge(radio, [
    row({ name: "Big List", platform: "deezer", followers: 300000, fit: "high" }),
    row({ name: "Unknown List", platform: "deezer", followers: null }),
  ]);
  const big = stations.find(s => s.name === "Big List");
  assert.equal(big.value, 5);
  assert.equal(big.provisional, true);
  assert.equal(stations.find(s => s.name === "Unknown List").value, 2);
});

test("BBC-named playlist stays its own row", () => {
  const { stations } = merge(radio, [row({ name: "BBC Sounds Indie Picks", platform: "spotify", followers: 500 })]);
  const p = stations.find(s => s.name === "BBC Sounds Indie Picks");
  assert.equal(p.type, "playlist");
  assert.match(stations.find(s => s.name === "BBC Introducing").notes, /Covers all 1 BBC entries/);
});

test("unknown platform becomes multi", () => {
  const { stations } = merge(radio, [row({ name: "Old Space", platform: "myspace", followers: "lots" })]);
  const p = stations.find(s => s.name === "Old Space");
  assert.equal(p.platform, "multi");
  assert.equal(p.followers, null);
});

test("radio rows alone get no playlist fields", () => {
  const { stations } = merge(radio);
  const r = stations.find(s => s.name === "Fen Radio");
  assert.ok(!("platform" in r) && !("followers" in r));
  assert.equal(r.category, "uk-local");
});

test("playlists are ranked on their own, so radio ranks don't move", () => {
  const { stations } = merge(radio, [row({ name: "Top List", platform: "spotify", followers: 900000, fit: "high" })]);
  const ranks = t => stations.filter(t).map(s => s.rank);
  assert.deepEqual(ranks(s => s.type !== "playlist"), [1, 2]);
  assert.deepEqual(ranks(s => s.type === "playlist"), [1]);
});

test("two playlists with the same URL fail the merge and name both", () => {
  assert.throws(() => merge(radio, [
    row({ name: "List A", platform: "spotify", url: "https://open.spotify.com/playlist/AbC" }),
    row({ name: "List B", platform: "spotify", url: "https://www.open.spotify.com/playlist/AbC/?si=1" }),
  ]), e => {
    const out = String(e.stdout) + String(e.stderr);
    assert.match(out, /Duplicate playlist URL open\.spotify\.com\/playlist\/AbC: "List A" and "List B"/);
    assert.ok(!existsSync(join(e.dir, "src/data/stations.json")));
    return true;
  });
});

test("playlist URLs differing only in path case both merge", () => {
  const { stations } = merge(radio, [
    row({ name: "List A", platform: "spotify", url: "https://open.spotify.com/playlist/AbC" }),
    row({ name: "List B", platform: "spotify", url: "https://open.spotify.com/playlist/abc" }),
  ]);
  assert.ok(["List A", "List B"].every(n => stations.some(s => s.name === n)));
});

test("radio rows sharing a URL both merge", () => {
  const { stations } = merge([
    row({ name: "Town FM", url: "https://town.fm" }),
    row({ name: "Town FM Late Show", url: "https://town.fm" }),
  ]);
  assert.equal(stations.filter(s => s.url === "https://town.fm").length, 2);
});

test("YouTube playlists with different list ids both merge", () => {
  const { stations } = merge(radio, [
    row({ name: "Tube A", platform: "youtube", url: "https://www.youtube.com/playlist?list=PLaaa" }),
    row({ name: "Tube B", platform: "youtube", url: "https://www.youtube.com/playlist?list=PLbbb&si=1" }),
  ]);
  assert.ok(["Tube A", "Tube B"].every(n => stations.some(s => s.name === n)));
});
