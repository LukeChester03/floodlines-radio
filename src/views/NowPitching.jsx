import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Pencil, Plus, Radio } from "lucide-react";
import { band, fmtRelease, templates } from "../songs.js";
import { useLocal } from "../store.js";
import { canGoLive, releaseBatch } from "../crm.js";
import { Modal, Sleeve } from "../ui/bits.jsx";

// The "now pitching" strip under the masthead. Every view works on the song chosen here.
export default function NowPitching({ songs, song, setSongId, stations, openSongForm, cloud, approve, setView }) {
  const [confirming, setConfirming] = useState(false);
  const [signoff] = useLocal("fl-signoff", band.signoff);
  const ok = canGoLive(song);
  const batch = ok ? releaseBatch(song, stations, songs, { template: (cloud.settings.templates || templates).pitch, signoff, includeOthers: cloud.settings.includeOthers !== false }) : [];
  const n = batch.length;
  const goLive = () => { approve(batch); setConfirming(false); setView("sendlist"); };
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

        <div className="now-live">
          <button className="btn btn-primary" disabled={!ok} aria-describedby="golive-hint" onClick={() => setConfirming(true)}><Radio size={16} aria-hidden="true" /> Go live</button>
          <span id="golive-hint" className="now-meta">{ok ? "Adds pitches to the Send list for review" : "Needs a streaming link and a release date"}</span>
        </div>

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
      <Modal open={confirming} onClose={() => setConfirming(false)} label={`Go live with ${song.title}`} className="songform">
        <h2 className="dlg-title">Go live with {song.title}</h2>
        <p className="dlg-sub" aria-live="polite">
          {n ? `${n} ${n === 1 ? "station" : "stations"} will get a personalised pitch for ${song.title}. They go into the Send list to review. Nothing is sent until you approve it.` : `No stations are waiting for ${song.title}. Everyone who fits has already been pitched or queued.`}
        </p>
        <div className="dlg-actions">
          <button className="btn btn-primary" disabled={!n} onClick={goLive}>Add {n} to the Send list</button>
          <button className="btn" onClick={() => setConfirming(false)}>Cancel</button>
        </div>
      </Modal>
    </section>
  );
}
