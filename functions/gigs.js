import { DEFAULT_GIG_AREAS, gigId, matchGigs, scoreGig } from "./core/gigs.js";
import { cleanPost } from "./read-post.js";
import { isHttp } from "./add-gig.js";

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
