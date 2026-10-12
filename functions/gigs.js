import { DEFAULT_GIG_AREAS, DEFAULT_GIG_PHRASES, gigId, matchGigs } from "./core/gigs.js";
import { slotQueries, searchSlots } from "./search.js";
import { readPost } from "./read-post.js";

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
