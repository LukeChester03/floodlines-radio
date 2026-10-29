const s = (v) => (typeof v === "string" ? v : "");
export const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v));

const band = (b) => (typeof b.link === "string" ? { name: b.name, link: b.link } : { name: b.name });

export function cleanPost(r, { url, text, source, now = Date.now }) {
  return {
    url, source, title: s(r.title), date: isDate(r.date) ? r.date : null,
    venue: s(r.venue), town: s(r.town), county: s(r.county), genre: s(r.genre),
    bands: Array.isArray(r.bands) ? r.bands.filter((b) => b && typeof b.name === "string" && b.name).map(band) : [],
    howToApply: s(r.howToApply), isSlotOffer: r.isSlotOffer === true,
    excerpt: s(text).slice(0, 280), foundAt: new Date(now()).toISOString(), score: 0, reasons: [],
  };
}
