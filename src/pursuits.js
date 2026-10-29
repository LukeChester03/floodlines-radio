import { songInfo } from "./crm.js";

// Everything the band is chasing (gigs, festivals, station follow-ups), each with its next action, soonest first
const day = ms => new Date(ms).toISOString().slice(0, 10);
const gigAction = { interested: "Apply", applied: "Hear back" };

export function activePursuits({ gigs, festivals, stations }, now) {
  const today = day(now);
  const item = x => ({ song: null, overdue: false, ...x });
  return [
    ...gigs
      .filter(g => gigAction[g.decision] && (!g.date || g.date >= today))
      .map(g => item({ kind: "gig", id: g.id, title: g.venue || g.title, action: gigAction[g.decision], date: g.date || null, view: "gigs" })),
    ...festivals
      .filter(f => f.decision === "applied" || (f.decision === "interested" && !(f.applyBy && f.applyBy < today)))
      .map(f => item({ kind: "festival", id: f.id, title: f.name, action: gigAction[f.decision], date: f.decision === "interested" ? f.applyBy || null : null, view: "festivals" })),
    ...stations.flatMap(s => Object.entries(s.songs || {}).flatMap(([song, rec]) => {
      const base = { kind: "station", id: s.id, song, title: s.name, view: "followups" };
      if (rec.status === "replied") {
        const latest = rec.log.map(l => l.at).sort().at(-1);
        return [item({ ...base, action: "Answer their reply", date: latest ? day(latest) : null })];
      }
      const { due } = songInfo(rec, now);
      if (!due) return [];
      const date = day(due);
      return [item({ ...base, action: "Follow up", date, overdue: date < today })];
    })),
  ].sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999") || (a.title || "").localeCompare(b.title || ""));
}
