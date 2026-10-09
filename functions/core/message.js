const addr = (s) => String(s ?? "").trim().toLowerCase();

// null when the entry may go out, otherwise the reason it must not.
export function canSend(entry, station, sends) {
  if (!station?.email || addr(station.email) !== addr(entry.to)) return "Station email does not match the recipient";
  if (station.rec?.dnc) return "Station is marked do-not-contact";
  if (station.rec?.bounced && addr(station.rec.bounced) === addr(entry.to)) return "This address has bounced";
  if (entry.kind === "pitch" && sends.some((s) => s.id === entry.id && s.song === entry.song && s.kind === "pitch")) {
    return "Already pitched for this song";
  }
  return null;
}

export function buildMessage(entry, from, priorSend) {
  const msg = { from, to: entry.to, subject: entry.subject, body: entry.body };
  if (entry.kind === "followup" && priorSend) {
    msg.threadId = priorSend.threadId;
    msg.inReplyTo = priorSend.messageId;
  }
  return msg;
}
