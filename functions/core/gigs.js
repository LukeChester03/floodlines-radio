export const DEFAULT_GIG_AREAS = ["Bristol", "Gloucestershire", "Berkshire", "London"];

export const DEFAULT_GIG_PHRASES = [
  "support slot", "bands wanted", "free slot", "looking for bands", "open slot", "support band wanted",
];

const DAY = 864e5;
const MAX_DAYS_AHEAD = 42;

export function gigId(url) {
  let s;
  try {
    const u = new URL(url);
    for (const k of [...u.searchParams.keys()]) if (k.startsWith("utm_") || k === "fbclid") u.searchParams.delete(k);
    u.hash = "";
    s = u.host.toLowerCase() + u.pathname.replace(/\/+$/, "") + u.search;
  } catch {
    s = String(url).trim().toLowerCase().replace(/\/+$/, "");
  }
  // cyrb53: plain JS, runs in the browser too
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
}

const lc = v => String(v || "").toLowerCase();

export function scoreGig(c, similarArtists, days) {
  let points = 0;
  const reasons = [];
  for (const artist of similarArtists) {
    const a = lc(artist);
    if (!a) continue;
    if ((c.bands || []).some(b => lc(b.name).includes(a))) {
      points += 30;
      reasons.push(`Bill includes ${artist}`);
    } else if (lc(`${c.title} ${c.excerpt}`).includes(a)) {
      points += 15;
      reasons.push(`Mentions ${artist}`);
    }
  }
  if (/indie|alt/.test(lc(c.genre))) {
    points += 10;
    reasons.push("Genre fits indie/alt rock");
  }
  if (c.howToApply) {
    points += 10;
    reasons.push("A way to apply is given");
  }
  if (days === null) reasons.push("Date not given");
  else {
    points += Math.round(((MAX_DAYS_AHEAD - days) / MAX_DAYS_AHEAD) * 20);
    reasons.push(days === 0 ? "Happening today" : `In ${days} days`);
  }
  return { score: points, reasons };
}

export function matchGigs(candidates, { areas = DEFAULT_GIG_AREAS, similarArtists = [] } = {}, now = new Date()) {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const wanted = areas.map(lc).filter(Boolean);
  const byId = new Map();
  for (const c of candidates) {
    if (!c.isSlotOffer) continue;
    let days = null;
    if (c.date) {
      days = Math.round((Date.parse(c.date) - today) / DAY);
      if (!(days >= 0 && days <= MAX_DAYS_AHEAD)) continue;
    }
    if (!wanted.some(a => [c.town, c.county, c.venue].some(f => lc(f).includes(a)))) continue;
    const id = gigId(c.url);
    if (byId.has(id)) continue;
    byId.set(id, { ...c, id, ...scoreGig(c, similarArtists, days) });
  }
  return [...byId.values()].sort((a, b) => b.score - a.score);
}
