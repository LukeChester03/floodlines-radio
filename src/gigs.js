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

// The only fields the band may write on a gig (see firestore.rules)
export function gigDecisionPatch(decision, now) {
  if (!gigDecisions.includes(decision)) throw new Error(`Unknown gig decision: ${decision}`);
  return { decision, decidedAt: now.toISOString() };
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

export function runSummary(status, now) {
  if (!status?.ranAt) return "Not searched yet";
  const d = Math.max(0, Math.floor((now - new Date(status.ranAt).getTime()) / 864e5));
  const n = status.errors?.length || 0;
  return `Last searched ${d === 0 ? "today" : d === 1 ? "1 day ago" : `${d} days ago`} · ${n} ${n === 1 ? "problem" : "problems"}`;
}
