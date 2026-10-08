import { useEffect, useRef } from "react";
import { animate, motion, useInView, useMotionValue, useTransform } from "motion/react";
import { songs } from "../band.js";
import { Water, flag, tierLabel } from "./common.jsx";

function Count({ to }) {
  const ref = useRef(null);
  const mv = useMotionValue(0);
  const shown = useTransform(mv, v => Math.round(v));
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView) return;
    const c = animate(mv, to, { duration: 1.4, ease: [0.16, 1, 0.3, 1] });
    return () => c.stop();
  }, [inView, to, mv]);
  return <motion.span ref={ref}>{shown}</motion.span>;
}

export default function Overview({ stations, due, queue, openBlanket, openDrawer, setView, selected, setSelected }) {
  const reachable = stations.filter(s => !["contact", "none"].includes(s.route));
  const contacted = stations.filter(s => s.rec.status !== "new" && s.rec.status !== "dnc").length;
  const replied = stations.filter(s => ["replied", "played"].includes(s.rec.status)).length;
  const played = stations.filter(s => s.rec.status === "played").length;
  const level = reachable.length ? contacted / reachable.length : 0;

  // Tide marks: the campaign as water rising up a flood gauge
  const marks = [
    { label: "Stations found", n: stations.length, h: 0.92 },
    { label: "You can apply to", n: reachable.length, h: 0.76 },
    { label: "Take email", n: stations.filter(s => s.route === "email").length, h: 0.6 },
    { label: "Pitched", n: contacted, h: 0.42 },
    { label: "Replied", n: replied, h: 0.24 },
    { label: "Played you", n: played, h: 0.08 },
  ];

  const next = reachable
    .filter(s => s.rec.status === "new" && s.genreFit !== "other" && !s.restricted && (s.tier === "start" || s.tier === "strong"))
    .slice(0, 8);
  const nextEmail = next.filter(s => s.route === "email").map(s => s.id);

  return (
    <div className="overview">
      <section className="gauge-hero">
        <div className="gauge-copy">
          <motion.p className="eyebrow" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>FloodLines radio campaign</motion.p>
          <h1>
            {["Every station", "you can send", "your music to"].map((l, i) => (
              <span className="hmask" key={l}>
                <motion.span initial={{ y: "105%" }} animate={{ y: 0 }} transition={{ type: "spring", stiffness: 100, damping: 16, delay: 0.1 + i * 0.1 }}>{l}</motion.span>
              </span>
            ))}
          </h1>
          <p className="lede">
            {stations.length} UK and international stations, each checked against its own website. Pick stations in the table, send them one personal pitch each for {songs.companion.title} or {songs.finalfear.title}, then track every reply and follow-up here until the water's over the top.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary" onClick={() => setView("table")}>Open all stations</button>
            {due.length > 0 && <button className="btn btn-alert" onClick={() => setView("followups")}>{due.length} follow-ups due</button>}
            {queue.length > 0 && <button className="btn" onClick={() => setView("sendlist")}>{queue.length} in the send list</button>}
          </div>
        </div>

        <div className="tank" role="img" aria-label={`${contacted} of ${reachable.length} reachable stations pitched`}>
          <Water level={level} />
          <ol className="marks">
            {marks.map(m => (
              <li key={m.label} style={{ bottom: `${m.h * 100}%` }}>
                <span className="mark-n"><Count to={m.n} /></span>
                <span className="mark-l">{m.label}</span>
              </li>
            ))}
          </ol>
          <span className="tank-level">{Math.round(level * 100)}% pitched</span>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Pitch these next</h2>
            <p>The highest-ranked stations you haven't contacted, based on how likely a play is for a band at your stage and what it's worth.</p>
          </div>
          {nextEmail.length > 0 && (
            <button className="btn btn-primary" onClick={() => openBlanket(nextEmail, "pitch")}>Email the {nextEmail.length} that take email</button>
          )}
        </div>
        <ol className="next-list">
          {next.map((s, i) => (
            <motion.li
              key={s.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
            >
              <button className="next-card" onClick={() => openDrawer(s.id)}>
                <span className="next-rank">#{s.rank}</span>
                <span className="next-name">{s.name}{s.show ? <small>{s.show}</small> : null}</span>
                <span className="next-meta">{flag(s.country)} {s.region} · {tierLabel[s.tier]}</span>
                <span className="next-why">{s.reasons[0]}</span>
                <span className={`next-route r-${s.route}`}>{s.route === "email" ? "Takes email" : s.route === "platform" ? "Uploader" : s.route === "form" ? "Form" : "Post"}</span>
              </button>
            </motion.li>
          ))}
        </ol>
      </section>

      <section className="panel how">
        <h2>How a campaign runs here</h2>
        <ol className="steps">
          <li><b>Pick.</b> Filter the table by region, genre, route and priority. Tick the stations you want.</li>
          <li><b>Pitch.</b> One personal email per station, never a group blast. Each is filled with their name or show, and you can edit any of them.</li>
          <li><b>Send.</b> Give the send list to Claude, who shows you every recipient and waits for your yes. Keep it to about 50 a day so Gmail doesn't flag you.</li>
          <li><b>Follow up.</b> If there's no reply after 10 days, send a one-line nudge. Try once more 14 days later, then move on.</li>
          <li><b>Track.</b> Move stations along the pipeline as they reply, play you or pass, and keep notes on each one.</li>
        </ol>
      </section>
    </div>
  );
}
