export const sendPace = { perRun: 50, perDay: 50 };

// mailRound runs once a day at this hour (UTC); the Send list's next-run time uses it too.
export const RUN_HOUR_UTC = 8;

const DAY = 24 * 3600e3;

// 00:00 UTC on the day of t (ms). The daily cap counts sends since then.
export const startOfUtcDay = (t) => Math.floor(t / DAY) * DAY;

// The next run strictly after t (ms).
export const nextRunAfter = (t) => {
  const run = startOfUtcDay(t) + RUN_HOUR_UTC * 3600e3;
  return run > t ? run : run + DAY;
};
