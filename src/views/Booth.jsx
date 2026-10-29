import { useMemo } from "react";
import { motion } from "motion/react";
import { ArrowRight, BellRing, DatabaseBackup, Inbox, Send } from "lucide-react";
import { download } from "../store.js";
import { exportAll } from "../cloud.js";
import { reachable } from "../../functions/core/stations.js";
import { activePursuits } from "../pursuits.js";
import { flag, tierLabel } from "../ui/bits.jsx";

// Overview for the song you're pitching: what to do next, and how far the campaign has got
const fmtDay = d => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

const songs_untouched = s => Object.values(s.per).every(p => p.status === "new" || p.status === "played") && !s.rec.notes && !s.rec.tags.length;

export default function Booth({ stations, songs, song, dueAll, queue, openMailer, openSheet, setView, cloud, user }) {
  const reach = stations.filter(reachable);
  const count = k => reach.filter(s => s.cur.status === k).length;
  const contacted = reach.filter(s => s.cur.status !== "new").length;
  const funnel = [
    ["Can apply", reach.length],
    ["Contacted", contacted],
    ["Replied", count("replied") + count("played")],
    ["Played", count("played")],
  ];
  const top = reach.filter(s => s.cur.status === "new" && !s.cur.queued).sort((a, b) => a.rank - b.rank).slice(0, 9);
  const topEmail = top.filter(s => s.route === "email").map(s => s.id);
  const queuedForSong = queue.filter(q => q.song === song.id).length;

  const cues = [
    { icon: BellRing, label: "Follow-ups due", n: dueAll.length, hot: dueAll.length > 0, go: "followups", text: dueAll.length ? "No reply yet and the wait is up, across all your songs." : "Nothing due right now." },
    { icon: Send, label: "In the send list", n: queuedForSong, hot: false, go: "sendlist", text: queuedForSong ? `Waiting to go out for ${song.title}.` : "Approve pitches to fill it." },
    { icon: Inbox, label: "Waiting on replies", n: count("pitched") + count("followed"), hot: false, go: "pipeline", text: "Pitched and not heard back yet." },
  ];

  const pursuits = useMemo(
    () => activePursuits({ gigs: cloud.gigs, festivals: cloud.festivals, stations: stations.filter(s => !s.rec.dnc).map(s => ({ id: s.id, name: s.name, songs: s.rec.songs })) }, Date.now()),
    [cloud.gigs, cloud.festivals, stations],
  );
  const songTitle = id => songs.find(sg => sg.id === id)?.title || id;

  const fresh = stations.every(s => songs_untouched(s));
  return (
    <div className="booth">
      {fresh && (
        <section className="intro-strip" aria-label="How this works">
          <p className="intro-lead">Your one place for every radio station FloodLines can send music to. Here's how a campaign runs:</p>
          <ol>
            <li><b>Pick stations</b> in Stations. Filter by region, genre or how they take music.</li>
            <li><b>Check the emails.</b> Blanket email writes one personal email per station for the song you're pitching. Read and edit each one.</li>
            <li><b>Approve &amp; send.</b> One tap approves the checked list. It then sends gradually from the band's Gmail, one personal email at a time.</li>
            <li><b>Track replies</b> in the pipeline. Follow-ups come up automatically 10 days after each pitch.</li>
          </ol>
        </section>
      )}
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

      <section className="card-panel" aria-labelledby="chasing-h">
        <h2 id="chasing-h" className="panel-title">On the go</h2>
        <p className="panel-sub">Every gig, festival and station you're chasing, with what to do next. Soonest first.</p>
        {pursuits.length === 0 ? (
          <p className="pursuits-empty">Nothing on the go. Mark a gig or festival interested, or pitch a station.</p>
        ) : (
          <ol className="pursuits">
            {pursuits.map(p => (
              <li key={`${p.kind}:${p.id}:${p.song || ""}`}>
                <button className={`pursuit${p.overdue ? " overdue" : ""}`} onClick={() => setView(p.view)}>
                  <span className="pursuit-action">{p.action}</span>
                  <span className="pursuit-title">{p.title}{p.song && <span className="pursuit-song"> for {songTitle(p.song)}</span>}</span>
                  <span className="pursuit-date">{p.overdue && <b>Overdue</b>}{p.date ? <time dateTime={p.date}>{fmtDay(p.date)}</time> : "No date"}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="card-panel" aria-labelledby="levels-h">
        <h2 id="levels-h" className="panel-title">{song.title}: campaign levels</h2>
        <div className="levels">
          {funnel.map(([label, n], i) => (
            <div className="level" key={label}>
              <span className="level-label">{label}</span>
              <span className="level-track">
                <motion.span
                  className={`level-fill${i === 0 ? " base" : ""}`}
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

      <section className="card-panel" aria-labelledby="data-h">
        <h2 id="data-h" className="panel-title">Your campaign data</h2>
        <p className="panel-sub">Saved in the band's shared database, so changes show up straight away on everyone's devices. Signed in as {user.email}. Download a copy now and then to keep for yourselves.</p>
        <div className="row-actions">
          <button className="btn" onClick={() => download(`floodlines-campaign-${new Date().toISOString().slice(0, 10)}.json`, exportAll(cloud))}><DatabaseBackup size={16} aria-hidden="true" /> Download a copy</button>
        </div>
      </section>
    </div>
  );
}
