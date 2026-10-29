import { gigId } from "./core/gigs.js";
import { isHttp } from "./add-gig.js";

// Saved at once as being read (tier null); the Mac job fills it in later.
// A festival already stored is returned as is, so a second paste never resets it or its decision.
export async function addPastedFestival({ url, note } = {}, { store, now = Date.now }) {
  url = typeof url === "string" ? url.trim() : "";
  if (!isHttp(url)) throw new Error("Paste the festival's link");
  note = typeof note === "string" && note.trim().length <= 1000 ? note.trim() : "";
  const id = gigId(url);
  const stored = await store.getFestival(id);
  if (stored) return stored;
  const festival = { id, url, note, source: "pasted", foundAt: new Date(now()).toISOString(), tier: null };
  await store.upsertFestival(festival);
  return festival;
}
