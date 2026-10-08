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

const used = new Set();
const out = [...seen.values()]
  .sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.fit] - { high: 0, medium: 1, low: 2 }[b.fit]) || a.name.localeCompare(b.name))
  .map(s => {
    let id = slug(`${s.name}-${s.show || ""}-${s.country}`);
    while (used.has(id)) id += "-x";
    used.add(id);
    return { id, ...s };
  });

writeFileSync("src/data/stations.json", JSON.stringify(out, null, 1));
const count = k => out.reduce((m, s) => ((m[s[k]] = (m[s[k]] || 0) + 1), m), {});
console.log(`${out.length} stations (${dropped} dropped/duplicates)`);
console.log("by group", count("group"));
console.log("by method", count("method"));
console.log("email allowed", out.filter(s => s.emailAllowed).length);
