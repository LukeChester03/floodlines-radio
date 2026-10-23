import { gigId, scoreGig } from "./core/gigs.js";
import { readPost } from "./read-post.js";

const DAY = 864e5;
export const isHttp = (u) => {
  try {
    return ["http:", "https:"].includes(new URL(u).protocol);
  } catch {
    return false;
  }
};

// The band chose this post, so it is kept whatever the area or date, but still scored.
export async function addPastedGig({ url, text } = {}, { store, ask, now = Date.now }) {
  if (typeof text !== "string" || !text.trim() || typeof url !== "string" || !isHttp(url.trim())) {
    throw new Error("Paste the post's link and its text");
  }
  url = url.trim();
  const post = await readPost({ url, text, source: "pasted" }, { ask, now });
  if (!post) throw new Error("Couldn't read that post");
  const settings = (await store.getSettings()) ?? {};
  const d = new Date(now());
  const days = post.date ? Math.max(0, Math.round((Date.parse(post.date) - Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())) / DAY)) : null;
  const gig = { ...post, id: gigId(url), ...scoreGig(post, settings.similarArtists ?? [], days) };
  await store.upsertGig(gig);
  return gig;
}
