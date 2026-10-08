export const band = {
  name: "FloodLines",
  email: "floodlinesbanduk@gmail.com",
  signoff: "Luke",
  instagram: "https://instagram.com/floodlinesband",
  linktree: "https://linktr.ee/floodlinesbanduk",
  spotifyArtist: "https://open.spotify.com/artist/79fFqlXiofeomTXRR7zaHt",
  soundcloud: "https://on.soundcloud.com/wK7ne0iylYQCR1BDFO",
  bio: "An independent indie rock four-piece formed at Loughborough University in 2025: Tom Whitticase, Phil Teiros, Luke Chester and Alex Sharp. Everything is recorded, produced, mixed and mastered at home.",
};

export const songs = {
  companion: {
    title: "Companion",
    released: "18 September 2026",
    spotify: "https://open.spotify.com/track/7GfQfUqx2U1pa3zNLzH6yW",
    cover: "companion.jpg",
    blurb: "Inspired by the 2025 film Companion, it's about a creator and the AI it builds, and what that AI learns from us.",
  },
  finalfear: {
    title: "Final Fear",
    released: "29 May 2026",
    spotify: "https://open.spotify.com/track/1qF1UkMK58WTiNKQnqbpOY",
    cover: "finalfear.jpg",
    blurb: "Our debut single, played on BBC Introducing in the East Midlands.",
  },
};

export const defaultTemplate = {
  subject: "Music submission: FloodLines – {song} (UK indie rock)",
  body: `Hi {name},

I'm {signoff} from FloodLines, an independent indie rock four-piece formed at Loughborough University. We'd love you to consider our {songDescriptor} "{song}" for {target}.

{songBlurb}

{links}

Our debut, "Final Fear", was played on BBC Introducing in the East Midlands in May. Everything we make is recorded and produced at home, and we can send WAVs or anything else you need.

More about us: ${band.linktree}

Thanks for listening,
{signoff}
FloodLines
${band.email} | @floodlinesband`,
};

// Fills a template for one station. pick is "companion", "finalfear" or "both".
export function fill(template, station, pick, signoff = band.signoff) {
  const lead = pick === "finalfear" ? songs.finalfear : songs.companion;
  const both = pick === "both";
  const song = both ? "Companion" : lead.title;
  const links = both
    ? `Companion (out now): ${songs.companion.spotify}\nFinal Fear: ${songs.finalfear.spotify}`
    : `Listen: ${lead.spotify}`;
  const map = {
    name: station.show ? `${station.show} team` : `${station.name} team`,
    target: station.show ? `${station.show} on ${station.name}` : station.name,
    song,
    songDescriptor: lead === songs.companion ? "new single" : "single",
    songBlurb: both
      ? `${songs.companion.blurb} We've included our debut too.`
      : lead.blurb,
    links,
    signoff,
  };
  const sub = s => s.replace(/\{(\w+)\}/g, (m, k) => (k in map ? map[k] : m));
  return { subject: sub(template.subject), body: sub(template.body) };
}
