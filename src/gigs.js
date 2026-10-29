// Gigs the band could play: pure helpers shared by the app and the weekly search.
import { DEFAULT_GIG_AREAS, DEFAULT_GIG_PHRASES } from "../functions/core/gigs.js";
export { DEFAULT_GIG_AREAS, DEFAULT_GIG_PHRASES };

// One entry per line: trimmed, blanks dropped, case-insensitive de-duplication keeps the first
export function parseList(text) {
  const seen = new Set();
  return String(text ?? "").split("\n").map(l => l.trim()).filter(l => l && !seen.has(l.toLowerCase()) && seen.add(l.toLowerCase()));
}

// Search settings with the defaults applied to empty lists
export function gigSettings(settings) {
  const list = (v, d) => (v?.length ? v : d);
  return { areas: list(settings?.gigAreas, DEFAULT_GIG_AREAS), similarArtists: settings?.similarArtists ?? [], phrases: list(settings?.gigPhrases, DEFAULT_GIG_PHRASES) };
}

// Stable id from the normalised URL (plain JS, so it also runs in the browser)
export function gigId(url) {
  let u;
  try { u = new URL(url); } catch { u = null; }
  let s = url;
  if (u) {
    [...u.searchParams.keys()].filter(k => k.startsWith("utm_") || k === "fbclid").forEach(k => u.searchParams.delete(k));
    s = `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, "")}${u.search}`;
  }
  let h = 5381;
  for (const c of s) h = (Math.imul(h, 33) ^ c.charCodeAt(0)) >>> 0;
  return h.toString(36);
}

const day = ms => new Date(ms).toISOString().slice(0, 10);

export const gigDecisions = ["interested", "applied", "booked", "passed"];

// The only fields the band may write on a gig (see firestore.rules); null clears the decision
export function gigDecisionPatch(decision, now) {
  if (decision !== null && !gigDecisions.includes(decision)) throw new Error(`Unknown gig decision: ${decision}`);
  return { decision, decidedAt: now.toISOString() };
}

// What the ticket stub and score stamp show; date parts are null when the date isn't known
export function gigStub(g) {
  const tier = g.score >= 50 ? "hot" : g.score >= 30 ? "warm" : "";
  if (!g.date) return { dow: null, day: null, mon: null, tier };
  const d = new Date(`${g.date}T00:00:00Z`);
  const part = opt => d.toLocaleString("en-GB", { ...opt, timeZone: "UTC" });
  return { dow: part({ weekday: "short" }), day: String(d.getUTCDate()), mon: part({ month: "short" }), tier };
}

// decision: "new" (undecided), a decision, or "all"; month: "YYYY-MM" or "" for any
export function gigView(gigs, { now, decision = "all", month = "" }) {
  const today = day(now);
  return gigs
    .filter(x => !x.date || x.date >= today)
    .filter(x => decision === "all" || (decision === "new" ? !x.decision : x.decision === decision))
    .filter(x => !month || x.date?.startsWith(month))
    .sort((a, b) => (b.score || 0) - (a.score || 0) || (a.date || "9999").localeCompare(b.date || "9999"));
}

// When the weekly search runs, UK time. Keep in step with StartCalendarInterval in functions/scripts/gig-hunt.plist
export const WEEKLY_SEARCH = { weekday: 1, hour: 7 };
const GRACE_MS = 6 * 36e5;
const tz = "Europe/London";
const ukParts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23" });
const ukDay = ms => new Date(ms).toLocaleString("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short" });

// UK wall clock as if it were UTC
function ukWall(ms) {
  const p = Object.fromEntries(ukParts.formatToParts(ms).map(x => [x.type, Number(x.value)]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}

// The scheduled run in the UK week offset by `weeks` from the one containing `now`
function scheduledRun(now, weeks) {
  const w = new Date(ukWall(now));
  const wall = Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate() + (WEEKLY_SEARCH.weekday - w.getUTCDay()) + 7 * weeks, WEEKLY_SEARCH.hour);
  return wall - (ukWall(wall) - wall);
}

export function runSummary(status, now) {
  const ranAt = status?.ranAt ? new Date(status.ranAt).getTime() : null;
  const thisWeek = scheduledRun(now, 0);
  const next = thisWeek > now ? thisWeek : scheduledRun(now, 1);
  const recent = next === thisWeek ? [scheduledRun(now, -1), scheduledRun(now, -2)] : [thisWeek, scheduledRun(now, -1)];
  const found = ranAt !== null && typeof status.found === "number" ? { total: status.found, new: status.saved ?? 0 } : null;
  return {
    last: ranAt === null ? null : `Last search ${ukDay(ranAt)}${found ? ` · found ${found.total}, ${found.new} new` : ""}`,
    next: `Next search ${ukDay(next)}, ${WEEKLY_SEARCH.hour}am`,
    missed: ranAt !== null && recent.some(t => t > ranAt && t + GRACE_MS < now),
    found,
    problems: (status?.errors ?? []).map(e => ({ where: e?.where ?? "", message: e?.message ?? "" })),
  };
}
