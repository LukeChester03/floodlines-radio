import { gigId } from "./core/gigs.js";

const isHttp = (u) => {
  try {
    return ["http:", "https:"].includes(new URL(u).protocol);
  } catch {
    return false;
  }
};

// Saved at once as being read (score null); the Mac job reads and scores it later.
export async function addPastedGig({ url, text } = {}, { store, now = Date.now }) {
  if (typeof text !== "string" || !text.trim() || typeof url !== "string" || !isHttp(url.trim())) {
    throw new Error("Paste the post's link and its text");
  }
  url = url.trim();
  const gig = { id: gigId(url), url, text, source: "pasted", excerpt: text.slice(0, 280), foundAt: new Date(now()).toISOString(), score: null, reasons: [] };
  await store.upsertGig(gig);
  return gig;
}
