// Festivals the band could apply to: pure helpers for the Festivals screen.
const festivalTiers = [["good", "Good shot"], ["worth", "Worth a shot"], ["long", "Long shot"], ["closed", "Closed"]];

const order = (a, b) => !!b.topPick - !!a.topPick || (a.applyBy || "9999").localeCompare(b.applyBy || "9999") || (a.name || "").localeCompare(b.name || "");

const day = ms => new Date(ms).toISOString().slice(0, 10);

// Each festival gains closingSoon: applyBy from today up to 14 days ahead (UTC days)
// decision: "new" (undecided), a decision, or "all", as on Gigs
export function festivalView(festivals, { now, decision = "all" }) {
  const shown = festivals.filter(x => decision === "all" || (decision === "new" ? !x.decision : x.decision === decision));
  const today = day(now), soon = day(now + 14 * 864e5);
  return festivalTiers
    .map(([tier, title]) => ({ tier, title, festivals: shown.filter(x => x.tier === tier).sort(order).map(x => ({ ...x, closingSoon: !!x.applyBy && x.applyBy >= today && x.applyBy <= soon })) }))
    .filter(t => t.festivals.length);
}
