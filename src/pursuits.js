import { songInfo } from "./crm.js";

// Everything the band is chasing (gigs, festivals, station follow-ups), each with its next action, soonest first
const day = ms => new Date(ms).toISOString().slice(0, 10);
const gigAction = { interested: "Apply", applied: "Hear back" };
const REPLY_ACTION = "Answer their reply";
const soonest = (a, b) => (a.date || "9999").localeCompare(b.date || "9999") || (a.title || "").localeCompare(b.title || "");

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
        return [item({ ...base, action: REPLY_ACTION, date: latest ? day(latest) : null })];
      }
      const { due } = songInfo(rec, now, s.route);
      if (!due) return [];
      const date = day(due);
      return [item({ ...base, action: "Follow up", date, overdue: date < today })];
    })),
  ].sort(soonest);
}

const sections = [
  { kind: "gig", title: "Gigs", view: "gigs" },
  { kind: "festival", title: "Festivals", view: "festivals" },
  { kind: "station", title: "Stations", view: "followups" },
];

// One card per station naming every song waiting. A reply leads if there is one, otherwise the soonest item
function stationCards(items) {
  const sorted = [...items].sort(soonest);
  return [...new Set(sorted.map(p => p.id))]
    .map(id => {
      const group = sorted.filter(p => p.id === id);
      const lead = group.find(p => p.action === REPLY_ACTION) || group[0];
      return { ...lead, songs: group.map(p => p.song) };
    })
    .sort(soonest);
}

export function pursuitSections(pursuits) {
  return sections
    .map(section => {
      const items = pursuits.filter(p => p.kind === section.kind);
      const cards = section.kind === "station" ? stationCards(items) : items.map(p => ({ ...p, songs: [] }));
      return { ...section, count: cards.length, cards };
    })
    .filter(section => section.count > 0);
}

// How far off a date is, in UTC calendar days like activePursuits
export function timingWords({ date, overdue }, now) {
  if (!date) return "No date";
  const days = (Date.parse(date) - Date.parse(day(now))) / 864e5;
  if (days === 0) return "Today";
  const span = `${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"}`;
  if (days > 0) return `In ${span}`;
  return overdue ? `${span} overdue` : `${span} ago`;
}
