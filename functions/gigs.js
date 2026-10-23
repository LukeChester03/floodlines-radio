import { DEFAULT_GIG_AREAS, DEFAULT_GIG_PHRASES, gigId, matchGigs, scoreGig } from "./core/gigs.js";
import { slotQueries, searchSlots } from "./search.js";
import { cleanPost, readPost } from "./read-post.js";
import { isHttp } from "./add-gig.js";

export async function gigRound({ store, search, ask, now = Date.now }) {
  const settings = (await store.getSettings()) ?? {};
  const areas = settings.gigAreas?.length ? settings.gigAreas : DEFAULT_GIG_AREAS;
  const phrases = settings.gigPhrases?.length ? settings.gigPhrases : DEFAULT_GIG_PHRASES;
  const similarArtists = settings.similarArtists ?? [];
  const queries = slotQueries(areas, phrases);
  const { results, errors: searchErrors } = await searchSlots(queries, { search });
  const errors = searchErrors.map((e) => ({ where: e.query, message: e.message }));
  const stored = new Set(await store.listGigIds());
  const fresh = results.filter((r) => !stored.has(gigId(r.url)));
  const candidates = [];
  for (const r of fresh) {
    const gig = await readPost({ url: r.url, text: r.content || r.title || "", source: "search" }, { ask, now });
    if (gig) candidates.push(gig);
    else errors.push({ where: r.url, message: "could not read post" });
  }
  const gigs = matchGigs(candidates, { areas, similarArtists }, new Date(now()));
  for (const g of gigs) await store.upsertGig(g);
  const status = { ranAt: new Date(now()).toISOString(), queries, found: results.length, read: fresh.length, saved: gigs.length, errors };
  await store.setGigStatus(status);
  return status;
}

// Posts a Claude session read, as plain JSON: { url, text, source: "search" | "pasted", ...fields }.
export async function importGigs({ store, posts, now = Date.now }) {
  const settings = (await store.getSettings()) ?? {};
  const areas = settings.gigAreas?.length ? settings.gigAreas : DEFAULT_GIG_AREAS;
  const similarArtists = settings.similarArtists ?? [];
  const d = new Date(now());
  const today = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const search = [];
  const pasted = [];
  const errors = [];
  for (const p of posts) {
    if (!p || typeof p !== "object" || typeof p.url !== "string" || !isHttp(p.url)) {
      errors.push({ where: typeof p?.url === "string" && p.url ? p.url : "(no url)", message: "could not read post" });
      continue;
    }
    const post = cleanPost(p, { url: p.url, text: p.text, source: p.source, now });
    if (post.source !== "pasted") search.push(post);
    else {
      // As addPastedGig: the band chose it, so keep it whatever the area or date.
      const days = post.date ? Math.max(0, Math.round((Date.parse(post.date) - today) / 864e5)) : null;
      pasted.push({ ...post, id: gigId(post.url), ...scoreGig(post, similarArtists, days) });
    }
  }
  const gigs = [...matchGigs(search, { areas, similarArtists }, d), ...pasted];
  for (const g of gigs) await store.upsertGig(g);
  return { read: posts.length, saved: gigs.length, errors };
}
