import { useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { gigView, runSummary } from "../gigs.js";
import { fmtDate } from "../crm.js";
import { Empty } from "../ui/bits.jsx";

const host = u => { try { return new URL(u).host; } catch { return u; } };
// A gig is still being read until it has been scored
const reading = g => g.score == null;

function Card({ g }) {
  if (reading(g)) {
    return (
      <motion.li layout className="gig-card gig-skeleton" aria-busy="true" initial={{ opacity: 0 }} animate={{ opacity: [0.5, 1, 0.5] }} exit={{ opacity: 0 }} transition={{ duration: 1.4, repeat: Infinity }}>
        <span className="sr-only">Reading this gig…</span>
        <span className="gig-bar" /><span className="gig-bar short" />
      </motion.li>
    );
  }
  const place = [g.town, g.county].filter(Boolean).join(", ");
  return (
    <motion.li layout className="gig-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.2 }}>
      <div className="gig-top">
        <b>{g.date ? fmtDate(new Date(g.date)) : "Date to confirm"}</b>
        <span className="sent-chip">{g.venue || g.title}</span>
        {place && <span className="muted">{place}</span>}
        {g.genre && <span className="tag">{g.genre}</span>}
        <span className="gig-score" title="Score">{g.score}</span>
      </div>
      {g.bands?.length > 0 && (
        <p className="gig-line"><span className="muted">On the bill: </span>
          {g.bands.map((b, i) => (
            <span key={b.name + i}>{i > 0 && ", "}{b.link ? <a className="link-btn" href={b.link} target="_blank" rel="noreferrer">{b.name}<span className="sr-only"> (new tab)</span></a> : b.name}</span>
          ))}
        </p>
      )}
      {g.howToApply && <p className="gig-line"><span className="muted">How to apply: </span>{g.howToApply}</p>}
      {g.reasons?.length > 0 && <ul className="gig-reasons">{g.reasons.map(r => <li key={r}>{r}</li>)}</ul>}
      <p className="gig-line"><a className="link-btn" href={g.url} target="_blank" rel="noreferrer">Original post · {host(g.url)}<span className="sr-only"> (new tab)</span></a></p>
    </motion.li>
  );
}

export default function Gigs({ cloud }) {
  const now = Date.now();
  const gigs = useMemo(() => gigView(cloud.gigs, { now: Date.now() }), [cloud.gigs]);
  return (
    <div className="gigs">
      <div className="view-head">
        <div>
          <h2 className="view-title">Gigs</h2>
          <p className="view-sub">{runSummary(cloud.gigStatus, now)}</p>
        </div>
      </div>
      {gigs.length === 0 ? (
        <Empty title="No gigs yet: the weekly search runs on Mondays." />
      ) : (
        <ul className="gig-list" aria-label="Upcoming gigs, best first">
          <AnimatePresence initial={false}>{gigs.map(g => <Card key={g.id} g={g} />)}</AnimatePresence>
        </ul>
      )}
    </div>
  );
}
