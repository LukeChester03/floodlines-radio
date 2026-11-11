export const reachable = s => !["contact", "none"].includes(s.route) && s.genreFit !== "other" && !s.rec.dnc;
// Radio and playlists are ranked separately, so screens that mix them order by score instead
export const byPriority = (a, b) => (b.score ?? -1) - (a.score ?? -1) || a.rank - b.rank;
