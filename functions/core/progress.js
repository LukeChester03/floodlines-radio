const DAY = 24 * 3600e3;
const RUN = 10 * 60e3;

// Where the campaign is: counts per state, sends in the last 24h against the daily cap, and the next scheduled run.
export function queueProgress(entries, sends, pace, now) {
  const t = new Date(now).getTime();
  const n = { review: 0, approved: 0, sending: 0, failed: 0 };
  for (const e of entries) {
    const s = e.state || "review";
    if (s in n) n[s]++;
  }
  const sentToday = sends.filter(s => { const age = t - new Date(s.sentAt).getTime(); return age >= 0 && age <= DAY; }).length;
  return { ...n, sentToday, cap: pace.perDay, nextRunAt: new Date((Math.floor(t / RUN) + 1) * RUN).toISOString() };
}

// Why a failed entry failed, for the Send list. null when the entry hasn't failed.
export function failureReason(entry) {
  if (entry.state !== "failed") return null;
  return entry.reason || "Couldn't send, no reason recorded";
}
