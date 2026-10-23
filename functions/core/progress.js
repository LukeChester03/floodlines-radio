import { startOfUtcDay, nextRunAfter } from "./pace.js";

// Where the campaign is: counts per state, sends since 00:00 UTC against the daily cap, and the next scheduled run.
export function queueProgress(entries, sends, pace, now) {
  const t = new Date(now).getTime();
  const n = { review: 0, approved: 0, sending: 0, failed: 0 };
  for (const e of entries) {
    const s = e.state || "review";
    if (s in n) n[s]++;
  }
  const dayStart = startOfUtcDay(t);
  const sentToday = sends.filter(s => { const at = new Date(s.sentAt).getTime(); return at >= dayStart && at <= t; }).length;
  return { ...n, sentToday, cap: pace.perDay, nextRunAt: new Date(nextRunAfter(t)).toISOString() };
}

// Why a failed entry failed, for the Send list. null when the entry hasn't failed.
export function failureReason(entry) {
  if (entry.state !== "failed") return null;
  return entry.reason || "Couldn't send, no reason recorded";
}
