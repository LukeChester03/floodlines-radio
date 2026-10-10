const MAX_QUERIES = 50;

export const slotQueries = (areas, phrases) =>
  areas.flatMap((a) => phrases.map((p) => `"${p}" ${a}`)).slice(0, MAX_QUERIES);

export async function searchSlots(queries, { search }) {
  const byUrl = new Map();
  const errors = [];
  for (const query of queries) {
    try {
      for (const r of await search(query)) if (!byUrl.has(r.url)) byUrl.set(r.url, r);
    } catch (e) {
      errors.push({ query, message: e.message });
    }
  }
  return { results: [...byUrl.values()], errors };
}

export const tavilySearch = (apiKey, fetch) => async (query) => {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ query, max_results: 10, time_range: "week", include_raw_content: true }),
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}`);
  const { results } = await res.json();
  return results.map((r) => ({ url: r.url, title: r.title, content: r.raw_content || r.content }));
};
