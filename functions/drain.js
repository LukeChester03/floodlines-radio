import { BAND_EMAIL } from "./core/band.js";
import { sendPace } from "./core/pace.js";
import { canSend, buildMessage } from "./core/message.js";

const DAY = 86400e3;
const MAX_EPK = 18 * 1024 * 1024;

// Send the oldest approved emails, within the per-run and per-day pace, recording each real send.
export async function drain({ store, transport, epk = { read: async () => null }, now = Date.now, pace = sendPace }) {
  if ((await store.getStatus()).needsReconnect) return { sent: 0 };
  const today = await store.listSends({ since: now() - DAY });
  const budget = Math.min(pace.perRun, pace.perDay - today.length);
  if (budget <= 0) return { sent: 0 };

  const sends = await store.listSends({ since: 0 });
  const queue = (await store.listSendlist({ state: "approved" }))
    .sort((a, b) => String(a.approvedAt).localeCompare(String(b.approvedAt)))
    .slice(0, budget);

  let file = null;
  let epkReason;
  if (queue.some((e) => e.kind === "pitch")) {
    try {
      file = await epk.read();
      if (file && file.data.length > MAX_EPK) epkReason = "EPK too large to attach (max 18 MB)";
    } catch (e) {
      epkReason = `Couldn't read the EPK: ${e.message}`;
    }
  }
  const attachments = file && !epkReason ? [file] : undefined;

  let sent = 0;
  for (const entry of queue) {
    const reason = canSend(entry, await store.getStation(entry.id), sends);
    if (reason) {
      await store.updateEntry(entry.key, { state: "failed", reason });
      continue;
    }
    if (entry.kind === "pitch" && epkReason) {
      await store.updateEntry(entry.key, { state: "failed", reason: epkReason });
      continue;
    }
    await store.updateEntry(entry.key, { state: "sending" });
    try {
      const prior = sends.find((s) => s.id === entry.id && s.song === entry.song && s.kind === "pitch");
      const { messageId, threadId } = await transport.send(buildMessage(entry, BAND_EMAIL, prior, attachments));
      const record = { id: entry.id, song: entry.song, kind: entry.kind, to: entry.to, subject: entry.subject, sentAt: new Date(now()).toISOString(), messageId, threadId };
      await store.addSend(record);
      sends.push(record);
      await store.updateEntry(entry.key, { state: "sent" });
      sent += 1;
    } catch (e) {
      if (e.code === "auth") {
        await store.setStatus({ needsReconnect: true });
        await store.updateEntry(entry.key, { state: "approved" });
        return { sent };
      }
      await store.updateEntry(entry.key, { state: "failed", reason: e.message });
    }
  }
  return { sent };
}
