const str = { type: "string" };
const schema = {
  type: "object",
  properties: {
    isSlotOffer: { type: "boolean" },
    title: str, date: str, venue: str, town: str, county: str, genre: str, howToApply: str,
    bands: { type: "array", items: { type: "object", properties: { name: str, link: str }, required: ["name"], additionalProperties: false } },
  },
  required: ["isSlotOffer"],
  additionalProperties: false,
};

export function anthropicAsk(apiKey) {
  return async (prompt) => {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const res = await new Anthropic({ apiKey }).messages.create({
      model: "claude-haiku-5-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
      output_config: { format: { type: "json_schema", schema } },
    });
    return JSON.parse(res.content.find((b) => b.type === "text").text);
  };
}

const s = (v) => (typeof v === "string" ? v : "");
const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v));

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

export async function readPost({ url, text, source }, { ask, now = Date.now }) {
  const foundAt = new Date(now()).toISOString();
  const prompt = `Today is ${foundAt.slice(0, 10)}. Read this post and say whether a band is offering a free, open or support slot at a gig. Give dates as YYYY-MM-DD, resolving phrases like "next Friday" from today's date; leave the date out if unsure.\n\nPost:\n${text}`;
  try {
    const r = await ask(prompt);
    if (!r || typeof r !== "object" || Array.isArray(r)) return null;
    return cleanPost(r, { url, text, source, now });
  } catch {
    return null;
  }
}
