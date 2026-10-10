import test from "node:test";
import assert from "node:assert/strict";
import { slotQueries, searchSlots, tavilySearch } from "./search.js";

test("slotQueries is area × phrase, capped at 50", () => {
  assert.deepEqual(
    slotQueries(["Brighton", "Southampton"], ["support slot", "bands wanted"]),
    ['"support slot" Brighton', '"bands wanted" Brighton', '"support slot" Southampton', '"bands wanted" Southampton'],
  );
  const n = (k) => Array.from({ length: 10 }, (_, i) => `${k}${i}`);
  assert.equal(slotQueries(n("a"), n("p")).length, 50);
});

test("searchSlots dedupes by URL and collects failures", async () => {
  const search = async (q) => {
    if (q === "bad") throw new Error("boom");
    return [{ url: "https://x/1", title: q, content: "c" }];
  };
  const r = await searchSlots(["a", "bad", "b"], { search });
  assert.equal(r.results.length, 1);
  assert.equal(r.results[0].url, "https://x/1");
  assert.deepEqual(r.errors, [{ query: "bad", message: "boom" }]);
});

test("tavilySearch POSTs with bearer key and maps results", async () => {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push([url, init]);
    return { ok: true, json: async () => ({ results: [
      { url: "u1", title: "t1", content: "short", raw_content: "full" },
      { url: "u2", title: "t2", content: "only", raw_content: null },
    ] }) };
  };
  const out = await tavilySearch("KEY", fetch)("q");
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "https://api.tavily.com/search");
  assert.equal(calls[0][1].method, "POST");
  assert.equal(calls[0][1].headers.Authorization, "Bearer KEY");
  const body = JSON.parse(calls[0][1].body);
  assert.equal(body.time_range, "week");
  assert.equal(body.query, "q");
  assert.deepEqual(out, [
    { url: "u1", title: "t1", content: "full" },
    { url: "u2", title: "t2", content: "only" },
  ]);
});
