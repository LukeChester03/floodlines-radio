import { gigId } from "./core/gigs.js";
import { isDate } from "./read-post.js";
import { isHttp } from "./add-gig.js";

const TEXT = ["name", "where", "when", "size", "pay", "asks", "deadline", "read", "note"];
const TIERS = ["good", "worth", "long", "closed"];

export async function importFestivals({ store, festivals, now = Date.now }) {
  const foundAt = new Date(now()).toISOString();
  const errors = [];
  let saved = 0;
  for (const f of festivals) {
    if (!f || typeof f !== "object" || typeof f.url !== "string" || !isHttp(f.url)) {
      errors.push({ where: typeof f?.url === "string" && f.url ? f.url : "(no url)", message: "could not read festival" });
      continue;
    }
    const topReasons = Array.isArray(f.topReasons) ? f.topReasons.filter((r) => typeof r === "string" && r).slice(0, 3) : [];
    const text = Object.fromEntries(TEXT.map((k) => [k, typeof f[k] === "string" ? f[k] : ""]));
    await store.upsertFestival({
      id: gigId(f.url), url: f.url, ...text,
      applyBy: isDate(f.applyBy) ? f.applyBy : null,
      tier: TIERS.includes(f.tier) ? f.tier : "worth",
      topPick: f.topPick === true && topReasons.length > 0, topReasons, source: f.source, foundAt,
    });
    saved += 1;
  }
  return { read: festivals.length, saved, errors };
}
