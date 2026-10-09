import { classify, matchReply } from "./core/replies.js";

// Ingest new mail: store each matched reply once and apply its effect to the station's song.
export async function syncReplies({ store, transport, bandEmail }) {
  const status = await store.getStatus();
  const { messages, nextCursor } = await transport.listNewMessages(status.replyCursor);
  const sends = await store.listSends({ since: 0 });
  const stations = await store.listStations();

  for (const msg of messages) {
    const outcome = classify(msg, bandEmail);
    if (outcome === "own") continue;
    const hit = matchReply(msg, sends, stations);
    if (!hit) continue;
    const { stationId, song } = hit;
    const fresh = await store.addReply({
      id: msg.id, stationId, song, threadId: msg.threadId, from: msg.from,
      date: msg.date, snippet: msg.snippet, outcome, decision: "undecided",
    });
    if (!fresh || !song) continue;

    const { email, rec } = await store.getStation(stationId);
    const cur = rec.songs?.[song] ?? { status: "new", log: [] };
    const next = { ...cur, log: [...cur.log, { type: outcome === "bounced" ? "bounce" : "reply", at: msg.date, text: msg.snippet }] };
    const patch = { songs: { ...rec.songs, [song]: next } };
    if (outcome !== "auto") next.status = outcome;
    if (outcome === "bounced") patch.bounced = email;
    await store.updateStation(stationId, patch);
  }
  await store.setStatus({ replyCursor: nextCursor });
}
