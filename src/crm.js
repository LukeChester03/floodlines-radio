import { sendPace } from "../functions/core/pace.js";
import { reachable } from "../functions/core/stations.js";
import { fill } from "./songs.js";
// Campaign state, tracked per station and per song. Stored in this browser and
// merged with the send log Claude writes after each send (src/data/sent-log.json).

export const statuses = [
  { key: "new", label: "Not pitched", hint: "Not sent this song yet" },
  { key: "pitched", label: "Pitched", hint: "First email sent" },
  { key: "followed", label: "Followed up", hint: "Nudged at least once" },
  { key: "replied", label: "Replied", hint: "They got back to you" },
  { key: "played", label: "Played", hint: "Airplay, add or session" },
  { key: "declined", label: "Passed", hint: "Not for them this time" },
];
export const statusLabel = Object.fromEntries(statuses.map(s => [s.key, s.label]));
export const ACTIVE = ["pitched", "followed"];

// Follow-up rhythm from radio promotion guides: a nudge after 1–2 weeks, a second two weeks later, then move on
export const FIRST_FOLLOW_UP_DAYS = 10;
export const SECOND_FOLLOW_UP_DAYS = 14;
export const MAX_FOLLOW_UPS = 2;
export const DAILY_SEND_CAP = sendPace.perDay; // well under Gmail's 500 a day, sent as separate personal emails

const DAY = 86400000;
export const blankStation = () => ({ starred: false, dnc: false, tags: [], notes: "", songs: {} });
export const blankSong = () => ({ status: "new", log: [] });

// Older versions kept one status per station; move that onto Companion
export function migrate(raw) {
  const out = {};
  for (const [id, r] of Object.entries(raw || {})) {
    if (r.songs) { out[id] = r; continue; }
    const songs = {};
    if ((r.status && r.status !== "new" && r.status !== "dnc") || (r.log || []).some(l => l.type === "pitch")) {
      songs.companion = { status: r.status === "dnc" ? "new" : r.status || "new", log: r.log || [] };
    }
    out[id] = { starred: !!r.starred, dnc: r.status === "dnc", tags: r.tags || [], notes: r.notes || "", songs };
  }
  return out;
}

// Known history (plays from before the site existed) and the send log Claude writes after each send
export function withSentLog(crm, sentLog) {
  const next = { ...crm };
  for (const s of sentLog) {
    const songId = s.song || "companion";
    const st = next[s.id] ? { ...next[s.id], songs: { ...next[s.id].songs } } : blankStation();
    const r = st.songs[songId] ? { ...st.songs[songId] } : blankSong();
    if (s.kind === "played") {
      if (!r.log.some(l => l.at === s.at && l.type === "history")) {
        r.log = [...r.log, { at: s.at, type: "history", text: s.subject }];
        if (r.status === "new") r.status = "played";
      }
      st.songs[songId] = r;
      next[s.id] = st;
      continue;
    }
    const kind = s.kind === "followup" ? "followup" : "pitch";
    if (!r.log.some(l => l.at === s.sentAt && l.type === kind)) {
      r.log = [...r.log, { at: s.sentAt, type: kind, text: `${kind === "pitch" ? "Pitched" : "Followed up"}: ${s.subject}` }];
      if (r.status === "new" || (kind === "followup" && r.status === "pitched")) r.status = kind === "pitch" ? "pitched" : "followed";
    }
    st.songs[songId] = r;
    next[s.id] = st;
  }
  return next;
}

export function songInfo(rec, now = Date.now()) {
  const r = rec || blankSong();
  const sends = r.log.filter(l => l.type === "pitch" || l.type === "followup").sort((a, b) => a.at.localeCompare(b.at));
  const last = sends.at(-1);
  const followUps = sends.filter(l => l.type === "followup").length;
  let due = null;
  if (last && ACTIVE.includes(r.status) && followUps < MAX_FOLLOW_UPS) {
    due = new Date(new Date(last.at).getTime() + (followUps === 0 ? FIRST_FOLLOW_UP_DAYS : SECOND_FOLLOW_UP_DAYS) * DAY);
  }
  return {
    status: r.status,
    lastAt: last ? new Date(last.at) : null,
    followUps,
    due,
    isDue: due ? due.getTime() <= now : false,
    movedOn: ACTIVE.includes(r.status) && followUps >= MAX_FOLLOW_UPS,
  };
}

export const sentKey = q => `${q.id}:${q.song || "companion"}:${q.kind === "followup" ? "followup" : "pitch"}`;
export const fmtDate = d => (d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—");

export const canGoLive = song => !!(song.link && song.released);

// One review-state pitch per station that fits and hasn't heard this song; never sends anything
export const releaseBatch = (song, stations, songs, { template, signoff, includeOthers }) =>
  stations
    .filter(s => reachable(s) && s.email && !s.rec.bounced && s.per[song.id].status === "new" && !s.per[song.id].queued)
    .map(s => {
      const d = fill(template, s, song, songs, { signoff, includeOthers });
      return { id: s.id, song: song.id, kind: "pitch", station: s.name, show: s.show, to: s.email, subject: d.subject, body: d.body, state: "review" };
    });
