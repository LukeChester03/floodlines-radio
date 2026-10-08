// The band, their songs and the email templates. Songs added in the app are stored in the browser.
export const band = {
  name: "FloodLines",
  email: "floodlinesbanduk@gmail.com",
  signoff: "Luke",
  linktree: "https://linktr.ee/floodlinesbanduk",
};

export const defaultSongs = [
  {
    id: "companion",
    title: "Companion",
    released: "2026-09-18",
    link: "https://open.spotify.com/track/7GfQfUqx2U1pa3zNLzH6yW",
    blurb: "Inspired by the 2025 film Companion, it's about a creator and the AI it builds, and what that AI learns from us.",
    cover: "companion.jpg",
    color: "#8E3B6B",
  },
  {
    id: "finalfear",
    title: "Final Fear",
    released: "2026-05-29",
    link: "https://open.spotify.com/track/1qF1UkMK58WTiNKQnqbpOY",
    blurb: "Our debut single, played on BBC Introducing in the East Midlands.",
    cover: "finalfear.jpg",
    color: "#3D6BFF",
  },
];

export const songSlug = title => title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "song";
export const fmtRelease = iso => (iso ? new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "");

export const templates = {
  pitch: {
    subject: "Music submission: FloodLines – {song} (UK indie/alt rock)",
    body: `Hi {name},

I'm {signoff} from FloodLines, an independent indie/alt rock four-piece formed at Loughborough University. We'd love you to consider our latest single "{song}" for {target}.

{songBlurb}

Listen: {songLink}
{otherSongs}
Everything we make is recorded and produced at home, and we can send WAVs or anything else you need.

More about us: ${band.linktree}

Thanks for listening,
{signoff}
FloodLines
${band.email} | @floodlinesband`,
  },
  followup: {
    subject: "Re: Music submission: FloodLines – {song}",
    body: `Hi {name},

Just following up on "{song}" by FloodLines, which I sent over recently, in case it got buried. Here it is again: {songLink}

Hope you enjoy it, and thanks for your time.

{signoff}
FloodLines`,
  },
};

export const placeholders = ["{name}", "{station}", "{target}", "{song}", "{songBlurb}", "{songLink}", "{otherSongs}", "{signoff}"];

// Fills a template for one station and one song
export function fill(template, station, song, songs, { signoff = band.signoff, includeOthers = true } = {}) {
  const first = station.contactName ? station.contactName.split(/[\s(]/)[0] : null;
  const today = new Date().toISOString().slice(0, 10);
  // Only released songs the band has chosen to mention
  const others = songs.filter(s => s.id !== song.id && s.link && s.mention !== false && (!s.released || s.released <= today));
  const map = {
    name: first || (station.show ? `${station.show} team` : `${station.name} team`),
    station: station.name,
    target: station.show ? `${station.show} on ${station.name}` : station.name,
    song: song.title,
    songBlurb: song.blurb || "",
    songLink: song.link || "",
    otherSongs: includeOthers && others.length ? `\nAlso from us: ${others.map(s => `"${s.title}" ${s.link}`).join(", ")}\n` : "",
    signoff,
  };
  const sub = s => s.replace(/\{(\w+)\}/g, (m, k) => (k in map ? map[k] : m));
  return { subject: sub(template.subject), body: sub(template.body).replace(/\n{3,}/g, "\n\n") };
}
