import test from "node:test";
import assert from "node:assert/strict";
import { fakeStore, fakeTransport } from "./fakes.js";
import { syncReplies } from "./replies.js";

const bandEmail = "band@gmail.com";
const setup = (messages) => ({
  store: fakeStore({
    stations: { s1: { email: "jo@station.com", rec: { songs: { companion: { status: "pitched", log: [] } } } } },
    sends: [{ id: "s1", song: "companion", kind: "pitch", to: "jo@station.com", sentAt: "2026-06-01T10:00:00Z", messageId: "<a>", threadId: "t1" }],
  }),
  transport: fakeTransport({ inbox: messages }),
});
const m = (o) => ({ id: "m1", threadId: "t1", from: "Jo <jo@station.com>", date: "2026-06-02T09:00:00Z", snippet: "Love it", headers: {}, ...o });
const song = async (store) => (await store.getStation("s1")).rec.songs.companion;

test("a reply on a pitch thread is stored, flips the song to replied and advances the cursor", async () => {
  const { store, transport } = setup([m()]);
  await syncReplies({ store, transport, bandEmail });
  const replies = await store.listReplies();
  assert.deepEqual(replies, [{ id: "m1", stationId: "s1", song: "companion", threadId: "t1", from: "Jo <jo@station.com>", date: "2026-06-02T09:00:00Z", snippet: "Love it", outcome: "replied", decision: "undecided" }]);
  const s = await song(store);
  assert.equal(s.status, "replied");
  assert.deepEqual(s.log, [{ type: "reply", at: "2026-06-02T09:00:00Z", text: "Love it" }]);
  assert.equal((await store.getStatus()).replyCursor, "1");
});

test("bounces flag the address, auto-replies only log, own and unmatched are ignored", async () => {
  const { store, transport } = setup([
    m({ id: "b", from: "MAILER-DAEMON@googlemail.com", snippet: "Address not found" }),
    m({ id: "a", headers: { "auto-submitted": "auto-replied" }, snippet: "Out of office" }),
    m({ id: "o", from: bandEmail }),
    m({ id: "u", threadId: "zz", from: "stranger@else.com" }),
  ]);
  await syncReplies({ store, transport, bandEmail });
  assert.deepEqual((await store.listReplies()).map((r) => [r.id, r.outcome]), [["b", "bounced"], ["a", "auto"]]);
  const st = await store.getStation("s1");
  assert.equal(st.rec.bounced, "jo@station.com");
  assert.equal(st.rec.songs.companion.status, "bounced");
  assert.equal(st.rec.songs.companion.log.length, 2);
});

test("an auto-reply leaves the status alone", async () => {
  const { store, transport } = setup([m({ headers: { "auto-submitted": "auto-replied" } })]);
  await syncReplies({ store, transport, bandEmail });
  assert.equal((await song(store)).status, "pitched");
});

test("syncing the same inbox twice stores each reply once", async () => {
  const { store, transport } = setup([m()]);
  await syncReplies({ store, transport, bandEmail });
  await syncReplies({ store, transport, bandEmail });
  assert.equal((await store.listReplies()).length, 1);
  assert.equal((await song(store)).log.length, 1);
});
