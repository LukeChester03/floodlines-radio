import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, BellRing, DatabaseBackup, Inbox, Send } from "lucide-react";
import { download } from "../store.js";
import { exportAll } from "../cloud.js";
import { reachable } from "../../functions/core/stations.js";
import { activePursuits, pursuitSections, songLevels, timingWords, weeklySends } from "../pursuits.js";
import { titles } from "../songs.js";
import { PlaylistTag, flag, tierLabel } from "../ui/bits.jsx";

// Overview for the song you're pitching: what to do next, and how far the campaign has got
const CARDS_PER_SECTION = 5;
const songs_untouched = s => Object.values(s.per).every(p => p.status === "new" || p.status === "played") && !s.rec.notes && !s.rec.tags.length;

// Bars scaled to how many stations the song can go to, each with its number beside it
function Levels({ rows, total }) {
  const still = useReducedMotion();
  return (
    <div className="levels">
      {rows.map(([label, n], i) => (
        <div className="level" key={label}>
          <span className="level-label">{label}</span>
          <span className="level-track">
            <motion.span
              className={`level-fill${label === "Can apply" ? " base" : ""}`}
              initial={still ? false : { width: 0 }}
              animate={{ width: `${total ? Math.max(n ? 2 : 0, (n / total) * 100) : 0}%` }}
              transition={{ type: "spring", stiffness: 60, damping: 16, delay: 0.15 + i * 0.1 }}
            />
          </span>
          <span className="level-n">{n}</span>
        </div>
      ))}
    </div>
  );
}

// One column per week, oldest first, scaled to the busiest week, each with its count above and its Monday below
function Weeks({ weeks }) {
  const still = useReducedMotion();
  const busiest = Math.max(...weeks.map(w => w.count));
  return (
    <ol className="weeks">
      {weeks.map(({ week, label, count }, i) => (
        <li className="week" key={week}>
          <span className="week-n">{count}</span>
          <span className="sr-only"> sent, week of </span>
          <span className="level-track week-track" aria-hidden="true">
            <motion.span
              className="level-fill week-fill"
              initial={still ? false : { height: 0 }}
              animate={{ height: `${count ? Math.max(2, (count / busiest) * 100) : 0}%` }}
              transition={{ type: "spring", stiffness: 60, damping: 16, delay: 0.15 + i * 0.05 }}
            />
          </span>
          <time className="week-label" dateTime={week}>{label}</time>
        </li>
      ))}
    </ol>
  );
}

const stageRows = ({ contacted, replied, played }) => [["Contacted", contacted], ["Replied", replied], ["Played", played]];

export default function Booth({ stations, songs, song, sends, followups, queue, openMailer, openSheet, setView, cloud, user }) {
  const reach = stations.filter(reachable);
  const count = k => reach.filter(s => s.cur.status === k).length;
  const levels = songLevels(stations, song.id);
  const top = reach.filter(s => s.cur.status === "new" && !s.cur.queued).sort((a, b) => a.rank - b.rank).slice(0, 9);
  const topEmail = top.filter(s => s.route === "email").map(s => s.id);
  const queuedForSong = queue.filter(q => q.song === song.id).length;

  const cues = [
    { icon: BellRing, label: "Follow-ups due", n: followups.due.length, hot: followups.due.length > 0, go: "followups", text: followups.due.length ? "No reply yet and the wait is up, across all your songs." : "Nothing due right now." },
    { icon: Send, label: "In the send list", n: queuedForSong, hot: false, go: "sendlist", text: queuedForSong ? `Waiting to go out for ${song.title}.` : "Approve pitches to fill it." },
    { icon: Inbox, label: "Waiting on replies", n: count("pitched") + count("followed"), hot: false, go: "pipeline", text: "Pitched and not heard back yet." },
  ];

  const pursuits = useMemo(
    () => activePursuits({ gigs: cloud.gigs, festivals: cloud.festivals, stations: stations.filter(s => !s.rec.dnc).map(s => ({ id: s.id, name: s.name, route: s.route, songs: s.rec.songs })) }, Date.now()),
    [cloud.gigs, cloud.festivals, stations],
  );
  const songTitle = id => songs.find(sg => sg.id === id)?.title || id;

  const fresh = stations.every(s => songs_untouched(s));
  const now = Date.now();
  const weeks = weeklySends(sends, now);
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

      <section className="card-panel" aria-labelledby="chasing-h">
        <h2 id="chasing-h" className="panel-title">On the go</h2>
        <p className="panel-sub">Every gig, festival and station you're chasing, with what to do next. Soonest first.</p>
        {pursuits.length === 0 ? (
          <p className="pursuits-empty">Nothing on the go. Mark a gig or festival interested, or pitch a station.</p>
        ) : (
          pursuitSections(pursuits).map(({ kind, title, view, count, cards }) => (
            <div className="pursuit-section" key={kind}>
              <h3 className="pursuit-head">{title} <span className="pursuit-count">{count}</span></h3>
              <ol className="next-grid">
                {cards.slice(0, CARDS_PER_SECTION).map(p => {
                  const when = timingWords(p, now);
                  return (
                    <li key={`${p.kind}:${p.id}`}>
                      <button className={`next-card pursuit${p.overdue ? " overdue" : ""}`} onClick={() => setView(p.view)}>
                        <span className="next-name pursuit-action">{p.action}</span>
                        <span className="pursuit-title">{p.title}{p.kind === "station" && <PlaylistTag type={stations.find(s => s.id === p.id)?.type} />}{p.songs.length > 0 && <span className="pursuit-song"> for {titles.format(p.songs.map(songTitle))}</span>}</span>
                        <span className="next-meta pursuit-when">{p.date ? <time dateTime={p.date}>{when}</time> : when}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
              {count > CARDS_PER_SECTION && (
                <button className="btn pursuit-all" aria-label={`See all ${count} ${title.toLowerCase()}`} onClick={() => setView(view)}>See all {count}<ArrowRight size={16} aria-hidden="true" /></button>
              )}
            </div>
          ))
        )}
      </section>

      <section className="card-panel" aria-labelledby="going-h">
        <h2 id="going-h" className="panel-title">How it's going</h2>
        <p className="panel-sub">Campaign bars are out of the stations you can apply to.</p>
        <div className="going">
          <div>
            <h3 className="pursuit-head">{song.title}: campaign levels</h3>
            <Levels rows={[["Can apply", levels.canApply], ...stageRows(levels)]} total={levels.canApply} />
          </div>
          <div>
            <h3 className="pursuit-head">Song by song</h3>
            <ul className="song-levels">
              {songs.map(sg => {
                const each = songLevels(stations, sg.id);
                return (
                  <li key={sg.id}>
                    <h4 className="song-levels-title">{sg.title}</h4>
                    <Levels rows={stageRows(each)} total={each.canApply} />
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="going-wide">
            <h3 className="pursuit-head">Emails sent</h3>
            {weeks.some(w => w.count) ? <Weeks weeks={weeks} /> : <p className="pursuits-empty">No emails sent in the last 8 weeks.</p>}
          </div>
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
                <span className="next-name">{s.name}<PlaylistTag type={s.type} /></span>
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
