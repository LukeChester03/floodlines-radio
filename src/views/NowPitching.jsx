import { AnimatePresence, motion } from "motion/react";
import { Pencil, Plus } from "lucide-react";
import { fmtRelease } from "../songs.js";
import { Sleeve } from "../ui/bits.jsx";

// The "now pitching" strip under the masthead. Every view works on the song chosen here.
export default function NowPitching({ songs, song, setSongId, stations, openSongForm }) {
  const by = k => stations.filter(s => s.cur.status === k).length;
  const sent = stations.filter(s => s.cur.status !== "new").length;
  const stats = [
    ["Contacted", sent],
    ["Replied", by("replied")],
    ["Played", by("played")],
  ];

  return (
    <section className="now" style={{ "--song": song.color }} aria-label="Song you're pitching">
      <div className="now-inner">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={song.id}
            className="now-sleeve"
            initial={{ rotateY: -90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: 90, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.3, 0.7, 0.4, 1] }}
          >
            <Sleeve song={song} size={72} />
          </motion.div>
        </AnimatePresence>

        <div className="now-text">
          <span className="now-label">Now pitching</span>
          <h1 className="now-title">{song.title}</h1>
          <span className="now-meta">{song.released ? `Out ${fmtRelease(song.released)}` : "Release date not set"}</span>
        </div>

        <dl className="now-stats">
          {stats.map(([k, v]) => (
            <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>

        <div className="now-switch" role="group" aria-label="Switch song">
          {songs.map(s => (
            <button key={s.id} className={`song-chip${s.id === song.id ? " on" : ""}`} aria-pressed={s.id === song.id} onClick={() => setSongId(s.id)} style={{ "--song": s.color }}>
              <Sleeve song={s} size={26} />
              <span>{s.title}</span>
            </button>
          ))}
          <button className="song-chip add" onClick={() => openSongForm("new")}><Plus size={16} aria-hidden="true" /> New single</button>
          <button className="icon-btn" onClick={() => openSongForm(song)} aria-label={`Edit ${song.title}`}><Pencil size={16} /></button>
        </div>
      </div>
    </section>
  );
}
