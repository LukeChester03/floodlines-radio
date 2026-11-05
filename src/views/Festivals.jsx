import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { festivalView } from "../festivals.js";
import { gigDecisions, ukTime } from "../gigs.js";
import { SearchStatus } from "./Gigs.jsx";
import { AddOverlay, Empty, Overlay } from "../ui/bits.jsx";

const label = d => d[0].toUpperCase() + d.slice(1);
const filters = ["new", ...gigDecisions, "all"];
const subtitles = { long: "Bigger festivals. Free to try, don't count on them." };
const part = (date, opt) => new Date(`${date}T00:00:00Z`).toLocaleString("en-GB", { ...opt, timeZone: "UTC" });

// What the last reading run did, above the Being read cards
function ReadingStatus({ status }) {
  if (!status) return <p className="warn reading-status">Not read yet. The reading job may not be running on the band's Mac.</p>;
  return (
    <div className="reading-status">
      <p className="view-sub">Last read {ukTime(status.at)}: {status.saved} of {status.read} filled in</p>
      {status.error && <p className="warn">{status.error}</p>}
      {status.unread.length > 0 && (
        <div className="search-problems">
          <p className="view-sub"><b>Couldn't read these, check them by hand</b></p>
          <ul>{status.unread.map(u => <li key={u}><a href={u} target="_blank" rel="noreferrer">{u}<span className="sr-only"> (new tab)</span></a></li>)}</ul>
        </div>
      )}
    </div>
  );
}

// What's known about a festival, leaving out anything empty
function Details({ f }) {
  const facts = [["Where", f.where], ["When", f.when], ["Size", f.size], ["Pay", f.pay]].filter(([, v]) => v);
  return (
    <>
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
    </>
  );
}

function Decisions({ f, decide }) {
  return (
    <div className="fest-seg" role="group" aria-label={`Your decision on ${f.name || "this festival"}`}>
      {gigDecisions.map(d => (
        <motion.button key={d} type="button" aria-pressed={f.decision === d} onClick={() => decide(f.id, f.decision === d ? null : d)} whileTap={{ scale: 0.94 }}>{label(d)}</motion.button>
      ))}
    </div>
  );
}

// f goes undefined when the festival is gone; the closing panel keeps its last render
function FestivalOverlay({ f, onClose, decide }) {
  const name = f?.name || f?.url;
  return (
    <Overlay
      open={!!f}
      onClose={onClose}
      label={name}
      eyebrow={f?.applyBy ? `Apply by ${part(f.applyBy, { day: "numeric", month: "short" })}` : "No set date"}
      title={name}
      footer={f && (
        <>
          <Decisions f={f} decide={decide} />
          <a className="btn" href={f.url} target="_blank" rel="noreferrer">Festival page<span className="sr-only"> (new tab)</span></a>
        </>
      )}
    >
      {f && <Details f={f} />}
    </Overlay>
  );
}

// A festival is a compact ticket: the stub holds the apply-by date, the rest waits in the overlay
function Card({ f, open }) {
  // Still being read until the Mac gives it a tier: no decision yet
  if (f.tier === null) {
    return (
      <motion.li layout className="fest-ticket reading" aria-busy="true" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
        <div className="fest-stub"><span className="gig-vu" aria-hidden="true"><i /><i /><i /><i /></span></div>
        <div className="fest-body">
          <p className="gig-reading">Reading this festival</p>
          <a className="fest-link fest-url" href={f.url} target="_blank" rel="noreferrer">{f.url}<span className="sr-only"> (new tab)</span></a>
          {f.note && <blockquote className="fest-read">{f.note}</blockquote>}
          <p className="gig-hint">Details fill in by themselves, usually within 15 minutes. If the band's Mac is asleep, it happens when it wakes.</p>
        </div>
      </motion.li>
    );
  }
  const name = f.name || f.url;
  const whereWhen = [f.where, f.when].filter(Boolean).join(", ");
  return (
    <motion.li layout className="fest-ticket" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.2 }}>
      <button type="button" className="fest-open" onClick={() => open(f.id)}><span className="sr-only">Details of {name}</span></button>
      <div className="fest-stub">
        {f.applyBy ? (
          <time dateTime={f.applyBy}><span className="fest-by">Apply by</span> <span className="fest-day">{part(f.applyBy, { day: "numeric" })}</span> <span className="fest-mon">{part(f.applyBy, { month: "short" })}</span></time>
        ) : <span className="fest-tbc">No set date</span>}
      </div>
      <div className="fest-body">
        <h4 className="fest-name">{name}</h4>
        {whereWhen && <p className="fest-line">{whereWhen}</p>}
        {(f.topPick || f.closingSoon || f.decision) && (
          <div className="fest-tags">
            {f.topPick && <span className="fest-pick-tag">Top pick</span>}
            {f.closingSoon && <span className="fest-soon">Closing soon</span>}
            {f.decision && <span className="fest-decision">{label(f.decision)}</span>}
          </div>
        )}
      </div>
    </motion.li>
  );
}

const addFields = [
  { name: "url", label: "Link to the festival", placeholder: "https://…" },
  { name: "note", label: "Note (optional)", rows: 3, maxLength: 1000 },
];

function AddFestival({ add }) {
  return (
    <AddOverlay
      button="Add a festival"
      title="Add a festival"
      hint="Found a festival online? Paste its link. It goes straight onto the list and fills in by itself."
      fields={addFields}
      submit="Add festival"
      fallback="Couldn't add that festival"
      add={add}
    />
  );
}

export default function Festivals({ cloud }) {
  const [decision, setDecision] = useState("all");
  const [openId, setOpenId] = useState(null);
  const tiers = useMemo(() => festivalView(cloud.festivals, { now: Date.now(), decision }), [cloud.festivals, decision]);
  // Looked up unfiltered, so the open festival stays live and survives a filter that hides it
  const opened = cloud.festivals.find(f => f.id === openId);
  if (openId && !opened) setOpenId(null);
  return (
    <div className="festivals">
      <div className="view-head">
        <div>
          <h2 className="view-title">Festivals</h2>
          <SearchStatus status={cloud.festivalStatus} />
          <p className="view-sub">Best chances first. Mark each one as you go.</p>
        </div>
      </div>
      <AddFestival add={cloud.addFestival} />
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
          {t.tier === null && <ReadingStatus status={cloud.readingStatus} />}
          <ul className="fest-list">
            <AnimatePresence initial={false}>{t.festivals.map(f => <Card key={f.id} f={f} open={setOpenId} />)}</AnimatePresence>
          </ul>
        </section>
      ))}
      <FestivalOverlay f={opened} onClose={() => setOpenId(null)} decide={cloud.decideFestival} />
    </div>
  );
}
