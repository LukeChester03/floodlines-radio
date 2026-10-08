import { motion } from "motion/react";
import { ArrowRight, BellRing, Inbox, Send } from "lucide-react";
import { flag, tierLabel } from "../ui/bits.jsx";

// Overview for the song you're pitching: what to do next, and how far the campaign has got
export default function Booth({ stations, song, due, queue, openMailer, openSheet, setView }) {
  const reach = stations.filter(s => !["contact", "none"].includes(s.route) && s.genreFit !== "other" && !s.rec.dnc);
  const count = k => reach.filter(s => s.cur.status === k).length;
  const pitched = reach.filter(s => s.cur.status !== "new").length;
  const funnel = [
    ["Can apply", reach.length],
    ["Pitched", pitched],
    ["Replied", count("replied") + count("played")],
    ["Played", count("played")],
  ];
  const top = reach.filter(s => s.cur.status === "new").sort((a, b) => a.rank - b.rank).slice(0, 9);
  const topEmail = top.filter(s => s.route === "email").map(s => s.id);
  const queuedForSong = queue.filter(q => q.song === song.id).length;

  const cues = [
    { icon: BellRing, label: "Follow-ups due", n: due.length, hot: due.length > 0, go: "followups", text: due.length ? "No reply yet and the wait is up." : "Nothing due right now." },
    { icon: Send, label: "In the send list", n: queuedForSong, hot: false, go: "sendlist", text: queuedForSong ? `Waiting to go out for ${song.title}.` : "Approve pitches to fill it." },
    { icon: Inbox, label: "Waiting on replies", n: count("pitched") + count("followed"), hot: false, go: "pipeline", text: "Pitched and not heard back yet." },
  ];

  return (
    <div className="booth">
      <div className="cues">
        {cues.map(({ icon: Icon, label, n, hot, go, text }, i) => (
          <motion.button
            key={label}
            className={`cue${hot ? " hot" : ""}`}
            onClick={() => setView(go)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, type: "spring", stiffness: 220, damping: 24 }}
            whileHover={{ y: -3 }}
          >
            <span className="cue-lamp" aria-hidden="true" />
            <Icon size={20} aria-hidden="true" />
            <span className="cue-n">{n}</span>
            <span className="cue-label">{label}</span>
            <span className="cue-text">{text}</span>
          </motion.button>
        ))}
      </div>

      <section className="card-panel" aria-labelledby="levels-h">
        <h2 id="levels-h" className="panel-title">{song.title}: campaign levels</h2>
        <div className="levels">
          {funnel.map(([label, n], i) => (
            <div className="level" key={label}>
              <span className="level-label">{label}</span>
              <span className="level-track">
                <motion.span
                  className="level-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${reach.length ? Math.max(n ? 2 : 0, (n / reach.length) * 100) : 0}%` }}
                  transition={{ type: "spring", stiffness: 60, damping: 16, delay: 0.15 + i * 0.1 }}
                />
              </span>
              <span className="level-n">{n}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card-panel" aria-labelledby="next-h">
        <div className="panel-head">
          <div>
            <h2 id="next-h" className="panel-title">Pitch {song.title} here next</h2>
            <p className="panel-sub">The highest-ranked stations that haven't had {song.title} yet, ranked for a band at your stage.</p>
          </div>
          <div className="panel-actions">
            {topEmail.length > 0 && <button className="btn btn-primary" onClick={() => openMailer(topEmail, "pitch")}>Email the {topEmail.length} that take email</button>}
            <button className="btn" onClick={() => setView("stations")}>All stations <ArrowRight size={16} aria-hidden="true" /></button>
          </div>
        </div>
        <ol className="next-grid">
          {top.map((s, i) => (
            <motion.li key={s.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i }}>
              <button className="next-card" onClick={() => openSheet(s.id)}>
                <span className="next-top"><span className="next-rank">#{s.rank}</span><span className={`route r-${s.route}`}>{s.route === "email" ? "Email" : s.route === "platform" ? "Uploader" : s.route === "form" ? "Form" : "Post"}</span></span>
                <span className="next-name">{s.name}</span>
                {s.show && <span className="next-show">{s.show}</span>}
                <span className="next-meta">{flag(s.country)} {s.region}{s.tier ? ` · ${tierLabel[s.tier]}` : ""}</span>
                {s.reasons[0] && <span className="next-why">{s.reasons[0]}</span>}
              </button>
            </motion.li>
          ))}
        </ol>
      </section>
    </div>
  );
}
