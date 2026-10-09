const addr = (s) => (/<([^>]+)>/.exec(s ?? "")?.[1] ?? s ?? "").trim().toLowerCase();

export function classify(msg, bandEmail) {
  const from = addr(msg.from);
  const [local] = from.split("@");
  const h = msg.headers ?? {};
  if (from === addr(bandEmail)) return "own";
  if (local === "mailer-daemon" || local === "postmaster") return "bounced";
  const sub = h["auto-submitted"];
  if (
    (sub != null && sub.trim().toLowerCase() !== "no") ||
    h["x-autoreply"] != null ||
    ["bulk", "auto_reply", "junk"].includes((h.precedence ?? "").trim().toLowerCase()) ||
    ["noreply", "no-reply", "donotreply"].includes(local)
  ) return "auto";
  return "replied";
}

export function matchReply(msg, sends, stations) {
  const h = msg.headers ?? {};
  const byTo = (send) => stations.find((s) => s.email && addr(s.email) === addr(send.to));
  const hit = (send) => {
    const st = byTo(send);
    return st && { stationId: st.id, song: send.song, kind: send.kind };
  };

  const thread = sends.find((s) => s.threadId && s.threadId === msg.threadId);
  if (thread && hit(thread)) return hit(thread);

  const refs = `${h["in-reply-to"] ?? ""} ${h.references ?? ""}`.split(/\s+/).filter(Boolean);
  const ref = sends.find((s) => s.messageId && refs.includes(s.messageId));
  if (ref && hit(ref)) return hit(ref);

  const station = stations.find((s) => s.email && addr(s.email) === addr(msg.from));
  if (!station) return null;
  const last = sends
    .filter((s) => addr(s.to) === addr(station.email))
    .sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt)))[0];
  return { stationId: station.id, song: last?.song ?? null, kind: last?.kind ?? null };
}
