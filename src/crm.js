// Campaign state for each station: status, notes, tags and a contact history.
// Kept in this browser, merged with the send log Claude writes after each send.

export const statuses = [
  { key: "new", label: "Not contacted", hint: "Not pitched yet" },
  { key: "pitched", label: "Pitched", hint: "First email sent" },
  { key: "followed", label: "Followed up", hint: "Nudged at least once" },
  { key: "replied", label: "Replied", hint: "They got back to you" },
  { key: "played", label: "Played us", hint: "Airplay, add or session" },
  { key: "declined", label: "Not for them", hint: "Passed this time" },
  { key: "dnc", label: "Do not contact", hint: "Asked not to be emailed, or skip" },
];
export const statusLabel = Object.fromEntries(statuses.map(s => [s.key, s.label]));

// Follow-up rhythm from radio promotion guides: one bump after 1–2 weeks, a second two weeks later, then move on
export const FIRST_FOLLOW_UP_DAYS = 10;
export const SECOND_FOLLOW_UP_DAYS = 14;
export const MAX_FOLLOW_UPS = 2;
export const DAILY_SEND_CAP = 50; // well under Gmail's 500 a day, sent as separate personal emails

const DAY = 86400000;
export const blank = () => ({ status: "new", starred: false, tags: [], notes: "", log: [] });

export function withSentLog(crm, sentLog) {
  const next = { ...crm };
  for (const s of sentLog) {
    const r = next[s.id] ? { ...next[s.id] } : blank();
    const kind = s.kind === "followup" ? "followup" : "pitch";
    if (!r.log.some(l => l.at === s.sentAt && l.type === kind)) {
      r.log = [...r.log, { at: s.sentAt, type: kind, text: `${kind === "pitch" ? "Pitched" : "Followed up"}: ${s.subject}` }];
      if (r.status === "new" || (kind === "followup" && r.status === "pitched")) r.status = kind === "pitch" ? "pitched" : "followed";
    }
    next[s.id] = r;
  }
  return next;
}

export function contactInfo(rec, now = Date.now()) {
  const sends = (rec?.log || []).filter(l => l.type === "pitch" || l.type === "followup").sort((a, b) => a.at.localeCompare(b.at));
  const last = sends.at(-1);
  const followUps = sends.filter(l => l.type === "followup").length;
  let due = null;
  if (last && ["pitched", "followed"].includes(rec.status)) {
    if (followUps < MAX_FOLLOW_UPS) {
      const wait = followUps === 0 ? FIRST_FOLLOW_UP_DAYS : SECOND_FOLLOW_UP_DAYS;
      due = new Date(new Date(last.at).getTime() + wait * DAY);
    }
  }
  return {
    lastAt: last ? new Date(last.at) : null,
    followUps,
    due,
    isDue: due ? due.getTime() <= now : false,
    movedOn: rec && ["pitched", "followed"].includes(rec.status) && followUps >= MAX_FOLLOW_UPS,
  };
}

export const fmtDate = d => (d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—");
export const daysAgo = (d, now = Date.now()) => (d ? Math.floor((now - d.getTime()) / DAY) : null);
