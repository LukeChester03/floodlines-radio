import { useEffect, useRef, useState } from "react";
import { animate, motion, useInView, useMotionValue, useTransform } from "motion/react";
import { band, songs } from "../band.js";

function Count({ to }) {
  const ref = useRef(null);
  const mv = useMotionValue(0);
  const shown = useTransform(mv, v => String(Math.round(v)).padStart(3, "0"));
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView) return;
    const c = animate(mv, to, { duration: 1.8, ease: [0.16, 1, 0.3, 1] });
    return () => c.stop();
  }, [inView, to, mv]);
  return <motion.span ref={ref}>{shown}</motion.span>;
}

export function Reel({ spinning, fast }) {
  return (
    <motion.span
      className="reel"
      animate={spinning ? { rotate: 360 } : { rotate: 0 }}
      transition={spinning ? { repeat: Infinity, ease: "linear", duration: fast ? 0.6 : 2.4 } : { duration: 0.3 }}
    >
      {[0, 60, 120, 180, 240, 300].map(a => <span key={a} className="reel-tooth" style={{ rotate: `${a}deg` }} />)}
    </motion.span>
  );
}

function Cassette({ song, side, i }) {
  const [hover, setHover] = useState(false);
  return (
    <motion.a
      href={song.spotify}
      target="_blank"
      rel="noopener"
      className={`cassette cassette-${i}`}
      initial={{ opacity: 0, y: 80, rotate: i ? 12 : -10 }}
      whileInView={{ opacity: 1, y: 0, rotate: i ? 4 : -3 }}
      viewport={{ once: true }}
      transition={{ type: "spring", stiffness: 80, damping: 12, delay: 0.2 + i * 0.15 }}
      whileHover={{ y: -12, rotate: 0, scale: 1.04 }}
      onHoverStart={() => setHover(true)}
      onHoverEnd={() => setHover(false)}
      aria-label={`Play ${song.title} on Spotify`}
    >
      <span className="cassette-label">
        <span className="cassette-art" style={{ backgroundImage: `url(${song.cover})` }} />
        <span className="cassette-side">{side}</span>
        <span className="cassette-title">{song.title}</span>
        <span className="cassette-date">FloodLines · {song.released}</span>
        <span className="cassette-window">
          <Reel spinning fast={hover} />
          <span className="cassette-tape" />
          <Reel spinning fast={hover} />
        </span>
      </span>
      <span className="cassette-foot" />
      <span className="cassette-play">{hover ? "Playing on Spotify" : "Play on Spotify"}</span>
    </motion.a>
  );
}

export default function Tapes({ stats }) {
  return (
    <section className="intro">
      <div className="intro-copy">
        <h1 className="intro-title">
          {["Every station", "FloodLines", "can apply to"].map((line, i) => (
            <span className="line-mask" key={i}>
              <motion.span
                className="line"
                initial={{ y: "110%", skewY: 6 }}
                animate={{ y: "0%", skewY: 0 }}
                transition={{ type: "spring", stiffness: 90, damping: 15, delay: 0.5 + i * 0.12 }}
              >
                {line}
              </motion.span>
            </span>
          ))}
        </h1>
        <p className="intro-lede">
          Every radio station in the UK and around the world that FloodLines can apply to, checked against its own website and ranked for where you are as a band right now. Tune the dial to a region, start at the top of the chart, draft a pitch for {songs.companion.title} or {songs.finalfear.title}, then give the send list to Claude to post from {band.email}.
        </p>
        <dl className="counters">
          <div><dt>You can apply to</dt><dd><Count to={stats.total} /></dd></div>
          <div><dt>Start here</dt><dd><Count to={stats.start} /></dd></div>
          <div><dt>Take email</dt><dd><Count to={stats.email} /></dd></div>
          <div><dt>Countries</dt><dd><Count to={stats.countries} /></dd></div>
        </dl>
      </div>
      <div className="tapes">
        <Cassette song={songs.companion} side="A" i={0} />
        <Cassette song={songs.finalfear} side="B" i={1} />
      </div>
    </section>
  );
}
