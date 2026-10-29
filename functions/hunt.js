import { readFileSync } from "node:fs";
import { DEFAULT_GIG_AREAS, DEFAULT_GIG_PHRASES, gigId } from "./core/gigs.js";
import { importGigs } from "./gigs.js";
import { importFestivals } from "./festivals.js";

const PROMPT = readFileSync(new URL("./scripts/gig-hunt-prompt.md", import.meta.url), "utf8");
const FESTIVAL_PROMPT = readFileSync(new URL("./scripts/festival-read-prompt.md", import.meta.url), "utf8");

export function huntPrompt({ areas, phrases, similarArtists, today }) {
  const fill = { areas: areas.join(", "), phrases: phrases.join(", "), similarArtists: similarArtists.join(", ") || "(none given)", today };
  return PROMPT.replace(/\{\{(\w+)\}\}/g, (_, k) => fill[k]);
}

// The first JSON array in a session's answer, allowing prose or a code fence around it.
export function parsePosts(text) {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text)?.[1];
  for (const s of [fenced, text]) {
    if (!s) continue;
    const start = s.indexOf("[");
    const end = s.lastIndexOf("]");
    if (start < 0 || end < start) continue;
    try {
      const v = JSON.parse(s.slice(start, end + 1));
      if (Array.isArray(v)) return v;
    } catch {}
  }
  throw new Error("no JSON array in the answer");
}

export async function gigHunt({ store, runSession, now = Date.now }) {
  const settings = (await store.getSettings()) ?? {};
  const areas = settings.gigAreas?.length ? settings.gigAreas : DEFAULT_GIG_AREAS;
  const phrases = settings.gigPhrases?.length ? settings.gigPhrases : DEFAULT_GIG_PHRASES;
  const similarArtists = settings.similarArtists ?? [];
  const today = new Date(now()).toISOString().slice(0, 10);
  const half = Math.ceil(areas.length / 2);
  const groups = [areas.slice(0, half), areas.slice(half)];
  const queries = groups.map((g) => g.join(" + "));
  const errors = [];
  const posts = [];
  for (const [i, group] of groups.entries()) {
    try {
      const answer = await runSession(huntPrompt({ areas: group, phrases, similarArtists, today }));
      posts.push(...parsePosts(answer));
    } catch (e) {
      errors.push({ where: queries[i], message: e.message });
    }
  }
  const stored = new Set(await store.listGigIds());
  const fresh = posts.filter((p) => !(typeof p?.url === "string" && stored.has(gigId(p.url))));
  const res = await importGigs({ store, posts: fresh.map((p) => ({ ...p, source: "search" })), now });
  const status = { ranAt: new Date(now()).toISOString(), queries, found: posts.length, read: res.read, saved: res.saved, errors: [...errors, ...res.errors] };
  await store.setGigStatus(status);
  return status;
}

export function pastedPrompt(gigs) {
  const posts = gigs.map((g) => `URL: ${g.url}\nPost:\n${g.text}`).join("\n\n---\n\n");
  return `You are reading gig posts for Floodlines, a band looking for support slots and open calls to play. The band pasted each post below themselves; read only the text given, don't search the web.

${posts}

Answer with only a JSON array, one object per URL above, with these fields:

- "url": the post's URL, exactly as given (required)
- "isSlotOffer": true if the post offers a slot or asks bands to apply, else false
- "title": a short name for the gig
- "date": the gig date as YYYY-MM-DD, or null
- "venue": the venue name, or null
- "town": the town or city, or null
- "county": the county, or null
- "genre": the genre, or null
- "howToApply": how a band applies (email, DM, form link), or null
- "bands": names of bands already on the bill, as an array
`;
}

// Reads the gigs pasted with Add a gig (score null) in one session. A post the answer leaves out stays queued.
export async function readPasted({ store, runSession, now = Date.now }) {
  const queued = await store.listReadingGigs();
  if (!queued.length) return { read: 0, saved: 0, errors: [] };
  let answers;
  try {
    answers = parsePosts(await runSession(pastedPrompt(queued)));
  } catch (e) {
    return { read: 0, saved: 0, errors: [{ where: "pasted", message: e.message }] };
  }
  const byId = new Map(queued.map((g) => [g.id, g]));
  const posts = [];
  for (const a of answers) {
    const g = typeof a?.url === "string" && byId.get(gigId(a.url));
    if (g) posts.push({ ...a, url: g.url, text: g.text, source: "pasted" });
  }
  return importGigs({ store, posts, now });
}

export function festivalPrompt(festivals, today) {
  const fill = { today, festivals: festivals.map((f) => `URL: ${f.url}\nNote: ${f.note || "(none)"}`).join("\n\n---\n\n") };
  return FESTIVAL_PROMPT.replace(/\{\{(\w+)\}\}/g, (_, k) => fill[k]);
}

// Reads the festivals pasted with Add a festival (tier null) in one session. A festival the answer leaves out stays queued.
export async function readPastedFestivals({ store, runSession, now = Date.now }) {
  const queued = await store.listReadingFestivals();
  if (!queued.length) return { read: 0, saved: 0, errors: [] };
  let answers;
  try {
    answers = parsePosts(await runSession(festivalPrompt(queued, new Date(now()).toISOString().slice(0, 10))));
  } catch (e) {
    return { read: 0, saved: 0, errors: [{ where: "pasted festivals", message: e.message }] };
  }
  const byId = new Map(queued.map((f) => [f.id, f]));
  const festivals = [];
  for (const a of answers) {
    const f = typeof a?.url === "string" && byId.get(gigId(a.url));
    if (f) festivals.push({ ...a, url: f.url, note: f.note, source: "pasted" });
  }
  return importFestivals({ store, festivals, now });
}
