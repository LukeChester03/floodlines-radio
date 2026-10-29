import { readFileSync } from "node:fs";
import { DEFAULT_GIG_AREAS, DEFAULT_GIG_PHRASES, gigId } from "./core/gigs.js";
import { importGigs } from "./gigs.js";

const PROMPT = readFileSync(new URL("./scripts/gig-hunt-prompt.md", import.meta.url), "utf8");

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
