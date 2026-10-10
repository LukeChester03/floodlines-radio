// Gigs the band could play: pure helpers shared by the app and the weekly search.
export const defaultGigAreas = [];
export const defaultSimilarArtists = [];
export const defaultGigPhrases = [];

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

export function gigView(gigs, { now }) {
  const today = day(now);
  return gigs
    .filter(x => !x.date || x.date >= today)
    .sort((a, b) => (b.score || 0) - (a.score || 0) || (a.date || "9999").localeCompare(b.date || "9999"));
}

export function runSummary(status, now) {
  if (!status?.ranAt) return "Not searched yet";
  const d = Math.max(0, Math.floor((now - new Date(status.ranAt).getTime()) / 864e5));
  const n = status.errors?.length || 0;
  return `Last searched ${d === 0 ? "today" : d === 1 ? "1 day ago" : `${d} days ago`} · ${n} ${n === 1 ? "problem" : "problems"}`;
}
