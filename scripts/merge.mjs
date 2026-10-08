// Merges the research files in research/*.json into src/data/stations.json.
// Normalises fields, drops bad emails, de-duplicates and groups stations by region.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";

const EU = new Set(["NL", "DE", "BE", "FR", "ES", "IT", "PT", "DK", "SE", "NO", "FI", "IS", "AT", "CH", "PL", "CZ", "SK", "HU", "SI", "HR", "GR", "LU", "EE", "LV", "LT", "RO", "BG", "MT", "CY", "RS", "UA"]);
const EMAIL = /^[^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,}$/i;

function group(country) {
  if (country === "GB") return "uk";
  if (country === "IE") return "ireland";
  if (country === "US") return "us";
  if (country === "CA") return "canada";
  if (country === "AU" || country === "NZ") return "ausnz";
  if (EU.has(country)) return "europe";
  return "world";
}

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);

// Manual corrections found during spot-checks, keyed by station name
const overrides = JSON.parse(readFileSync("scripts/overrides.json", "utf8"));

const files = readdirSync("research").filter(f => f.endsWith(".json"));
const seen = new Map();
let dropped = 0;

for (const f of files) {
  for (const r of JSON.parse(readFileSync(`research/${f}`, "utf8"))) {
    if (!r || !r.name || !r.url) { dropped++; continue; }
    const country = String(r.country || "").toUpperCase().slice(0, 2);
    let email = r.email ? String(r.email).trim().replace(/^mailto:/i, "").split("?")[0] : null;
    if (email && !EMAIL.test(email)) email = null;
    const method = ["email", "form", "platform", "post", "none-found"].includes(r.method) ? r.method : "none-found";
    const s = {
      name: String(r.name).trim(),
      show: r.show ? String(r.show).trim() : null,
      country,
      group: group(country),
      region: r.region || "",
      type: r.type || "community",
      url: r.url,
      method: method === "email" && !email ? (r.formUrl ? "form" : "none-found") : method,
      email,
      emailAllowed: Boolean(r.emailAllowed && email),
      formUrl: r.formUrl || null,
      paid: Boolean(r.paid),
      instructions: r.instructions || "",
      fit: ["high", "medium", "low"].includes(r.fit) ? r.fit : "medium",
      sourceUrl: r.sourceUrl || r.url,
      notes: r.notes || null,
      ...(overrides[String(r.name).trim()] || {}),
    };
    const key = (s.emailAllowed ? s.email.toLowerCase() : "") + "|" + slug(s.name) + "|" + slug(s.show || "");
    if (seen.has(key)) { dropped++; continue; }
    seen.set(key, s);
  }
}

// Scores from the per-station judgement pass (research/scores/*.json), keyed by id
const scores = new Map();
try {
  for (const f of readdirSync("research/scores").filter(f => f.endsWith(".json")))
    for (const r of JSON.parse(readFileSync(`research/scores/${f}`, "utf8"))) scores.set(r.id, r);
} catch { /* no scores yet */ }

const EAST_MIDS = /(east midlands|leicester|loughborough|nottingham|derby|lincoln|northampton|rutland|mansfield|coalville|melton|hinckley)/i;
function category(s) {
  if (s.group === "uk" && (/\bBBC\b/.test(s.name) || EAST_MIDS.test(s.region || ""))) return "bbc-em";
  if (s.group === "uk" && s.type === "student") return "uk-student";
  if (s.group === "uk" && ["community", "regional"].includes(s.type)) return "uk-local";
  if (s.group === "uk") return "uk-national";
  if (s.group === "us" && s.type === "college") return "us-college";
  if (s.group === "us") return "us-other";
  if (s.group === "canada") return "canada";
  if (s.group === "ausnz") return "ausnz";
  return "europe";
}
// Provisional score for stations the judgement pass hasn't reached yet
function provisional(s) {
  const chance = { high: 4, medium: 3, low: 2 }[s.fit] - (s.paid ? 1 : 0);
  const value = { national: 4, public: 4, regional: 3, show: 3, online: 2, commercial: 3, college: 2, student: 2, community: 2 }[s.type] || 2;
  return { eligible: true, chance, value, reasons: ["Not ranked by hand yet"], pitchTip: null, provisional: true };
}
// Start here: good odds and worth having. Strong: good odds, smaller prize.
// Long shots: big stations with poor odds today, or anything with very poor odds.
const tierOf = (chance, value, score) =>
  chance >= 3 && score >= 60 ? "start"
  : chance >= 3 && score >= 52 ? "strong"
  : chance <= 2 && value >= 4 ? "long"
  : chance >= 2 ? "worth"
  : "long";

// Genre tags from the genre pass (research/genres/*.json), keyed by id
const genres = new Map();
try {
  for (const f of readdirSync("research/genres").filter(f => f.endsWith(".json")))
    for (const r of JSON.parse(readFileSync(`research/genres/${f}`, "utf8"))) genres.set(r.id, r);
} catch { /* no genre pass yet */ }

const routeOf = s =>
  s.emailAllowed ? "email"
  : s.method === "email" ? "contact"
  : s.method === "none-found" ? "none"
  : s.method;

const used = new Set();
const all = [...seen.values()].map(s => {
  let id = slug(`${s.name}-${s.show || ""}-${s.country}`);
  while (used.has(id)) id += "-x";
  used.add(id);
  return { id, ...s };
});
const out = all
  .map(s => {
    const route = routeOf(s);
    const j = scores.get(s.id) || (["contact", "none"].includes(route) ? null : provisional(s));
    const g = genres.get(s.id) || {};
    const score = j ? j.chance * 12 + j.value * 8 : null;
    return {
      ...s,
      route,
      category: category(s),
      restricted: j ? j.eligible === false : false,
      chance: j ? j.chance : null,
      value: j ? j.value : null,
      score,
      tier: j ? tierOf(j.chance, j.value, score) : null,
      reasons: j ? j.reasons || [] : [],
      pitchTip: j ? j.pitchTip || null : null,
      provisional: j ? !!j.provisional : false,
      genreFit: g.genreFit || "unknown",
      genres: g.genres || null,
      contactName: g.contactName || null,
    };
  })
  .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.name.localeCompare(b.name))
  .map((s, i) => ({ ...s, rank: i + 1 }));
writeFileSync("src/data/stations.json", JSON.stringify(out, null, 1));
const count = k => out.reduce((m, s) => ((m[s[k]] = (m[s[k]] || 0) + 1), m), {});
console.log(`${out.length} stations (${dropped} dropped/duplicates)`);
console.log("by group", count("group"));
console.log("by method", count("method"));
console.log("by tier", count("tier"));
console.log("by route", count("route"));
console.log("by genre fit", count("genreFit"));
console.log("restricted", out.filter(s => s.restricted).length);
console.log("by category", count("category"));
console.log("provisional", out.filter(s => s.provisional).length);
console.log("email allowed", out.filter(s => s.emailAllowed).length);
