import { BAND_EMAIL } from "./core/band.js";
import { sendPace } from "./core/pace.js";
import { canSend, buildMessage } from "./core/message.js";

const DAY = 86400e3;

// Send the oldest approved emails, within the per-run and per-day pace, recording each real send.
export async function drain({ store, transport, now = Date.now, pace = sendPace }) {
  const today = await store.listSends({ since: now() - DAY });
  const budget = Math.min(pace.perRun, pace.perDay - today.length);
  if (budget <= 0) return { sent: 0 };

  const sends = await store.listSends({ since: 0 });
  const queue = (await store.listSendlist({ state: "approved" }))
    .sort((a, b) => String(a.approvedAt).localeCompare(String(b.approvedAt)))
    .slice(0, budget);

  let sent = 0;
  for (const entry of queue) {
    const reason = canSend(entry, await store.getStation(entry.id), sends);
    if (reason) {
      await store.updateEntry(entry.key, { state: "failed", reason });
      continue;
    }
    await store.updateEntry(entry.key, { state: "sending" });
    try {
      const prior = sends.find((s) => s.id === entry.id && s.song === entry.song && s.kind === "pitch");
      const { messageId, threadId } = await transport.send(buildMessage(entry, BAND_EMAIL, prior));
      const record = { id: entry.id, song: entry.song, kind: entry.kind, to: entry.to, subject: entry.subject, sentAt: new Date(now()).toISOString(), messageId, threadId };
      await store.addSend(record);
      sends.push(record);
      await store.updateEntry(entry.key, { state: "sent" });
      sent += 1;
    } catch (e) {
      await store.updateEntry(entry.key, { state: "failed", reason: e.message });
    }
  }
  return { sent };
}
