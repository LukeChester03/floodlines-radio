import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { festivalView } from "../festivals.js";
import { gigDecisions } from "../gigs.js";
import { Empty } from "../ui/bits.jsx";

const label = d => d[0].toUpperCase() + d.slice(1);
const filters = ["new", ...gigDecisions, "all"];
const subtitles = { long: "Bigger festivals. Free to try, don't count on them." };
const part = (date, opt) => new Date(`${date}T00:00:00Z`).toLocaleString("en-GB", { ...opt, timeZone: "UTC" });

// A festival is a ticket: the stub holds the apply-by date, the body the festival
function Card({ f, decide }) {
  const facts = [["Where", f.where], ["When", f.when], ["Size", f.size], ["Pay", f.pay]].filter(([, v]) => v);
  return (
    <motion.li layout className="fest-ticket" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.2 }}>
      <div className="fest-stub">
        {f.applyBy ? (
          <time dateTime={f.applyBy}><span className="fest-by">Apply by</span> <span className="fest-day">{part(f.applyBy, { day: "numeric" })}</span> <span className="fest-mon">{part(f.applyBy, { month: "short" })}</span></time>
        ) : <span className="fest-tbc">No set date</span>}
      </div>
      <div className="fest-body">
        <div className="fest-head">
          <h4 className="fest-name">{f.name || f.url}</h4>
          {f.closingSoon && <span className="fest-soon">Closing soon</span>}
        </div>
        {f.topPick && (
          <div className="fest-pick">
            <span className="fest-pick-tag">Top pick</span>
            {f.topReasons?.length > 0 && <ul className="fest-why">{f.topReasons.map(r => <li key={r}>{r}</li>)}</ul>}
          </div>
        )}
        {facts.length > 0 && <dl className="fest-facts">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
        {f.asks && <p className="fest-asks"><b>They ask for:</b> {f.asks}</p>}
        {f.deadline && <p><span className="fest-muted">Deadline: </span>{f.deadline}</p>}
        {f.read && <blockquote className="fest-read">{f.read}</blockquote>}
        <div className="fest-foot">
          <div className="fest-seg" role="group" aria-label={`Your decision on ${f.name || "this festival"}`}>
            {gigDecisions.map(d => (
              <motion.button key={d} type="button" aria-pressed={f.decision === d} onClick={() => decide(f.id, f.decision === d ? null : d)} whileTap={{ scale: 0.94 }}>{label(d)}</motion.button>
            ))}
          </div>
          <a className="fest-link" href={f.url} target="_blank" rel="noreferrer">Festival page<span className="sr-only"> (new tab)</span></a>
        </div>
      </div>
    </motion.li>
  );
}

export default function Festivals({ cloud }) {
  const [decision, setDecision] = useState("all");
  const tiers = useMemo(() => festivalView(cloud.festivals, { now: Date.now(), decision }), [cloud.festivals, decision]);
  return (
    <div className="festivals">
      <div className="view-head">
        <div>
          <h2 className="view-title">Festivals</h2>
          <p className="view-sub">Best chances first. Mark each one as you go.</p>
        </div>
      </div>
      {cloud.festivals.length > 0 && (
        <div className="gig-filters">
          <div role="group" aria-label="Filter by decision" className="gig-decide">
            {filters.map(f => <button key={f} type="button" className={`view-chip${decision === f ? " on" : ""}`} aria-pressed={decision === f} onClick={() => setDecision(f)}>{label(f)}</button>)}
          </div>
        </div>
      )}
      {tiers.length === 0 ? (
        <Empty title={cloud.festivals.length ? "No festivals match this filter." : "No festivals yet: the list hasn't been loaded."} />
      ) : tiers.map(t => (
        <section key={t.tier} className="fest-tier" aria-labelledby={`fest-${t.tier}`}>
          <h3 id={`fest-${t.tier}`} className="fest-tier-title">{t.title}</h3>
          {subtitles[t.tier] && <p className="fest-tier-sub">{subtitles[t.tier]}</p>}
          <ul className="fest-list">
            <AnimatePresence initial={false}>{t.festivals.map(f => <Card key={f.id} f={f} decide={cloud.decideFestival} />)}</AnimatePresence>
          </ul>
        </section>
      ))}
    </div>
  );
}
