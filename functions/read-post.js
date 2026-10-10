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

export async function readPost({ url, text, source }, { ask, now = Date.now }) {
  const foundAt = new Date(now()).toISOString();
  const prompt = `Today is ${foundAt.slice(0, 10)}. Read this post and say whether a band is offering a free, open or support slot at a gig. Give dates as YYYY-MM-DD, resolving phrases like "next Friday" from today's date; leave the date out if unsure.\n\nPost:\n${text}`;
  try {
    const r = await ask(prompt);
    if (!r || typeof r !== "object" || Array.isArray(r)) return null;
    return {
      url, source, title: s(r.title), date: isDate(r.date) ? r.date : null,
      venue: s(r.venue), town: s(r.town), county: s(r.county), genre: s(r.genre),
      bands: Array.isArray(r.bands) ? r.bands : [],
      howToApply: s(r.howToApply), isSlotOffer: r.isSlotOffer === true,
      excerpt: text.slice(0, 280), foundAt, score: 0, reasons: [],
    };
  } catch {
    return null;
  }
}
