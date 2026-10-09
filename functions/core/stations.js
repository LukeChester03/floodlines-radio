export const reachable = s => !["contact", "none"].includes(s.route) && s.genreFit !== "other" && !s.rec.dnc;
