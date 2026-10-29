import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { festivalView } from "../festivals.js";
import { gigDecisions, runSummary } from "../gigs.js";
import { Plus } from "lucide-react";
import { Empty } from "../ui/bits.jsx";

const label = d => d[0].toUpperCase() + d.slice(1);
const filters = ["new", ...gigDecisions, "all"];
const subtitles = { long: "Bigger festivals. Free to try, don't count on them." };
const part = (date, opt) => new Date(`${date}T00:00:00Z`).toLocaleString("en-GB", { ...opt, timeZone: "UTC" });

// A festival is a ticket: the stub holds the apply-by date, the body the festival
function Card({ f, decide }) {
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

function AddFestival({ add }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const opener = useRef(null);
  const close = () => { setOpen(false); setError(""); setTimeout(() => opener.current?.focus(), 0); };
  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await add(url.trim(), note);
      setUrl(""); setNote("");
      close();
    } catch (err) {
      setError(err.message || "Couldn't add that festival");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="gig-add">
      <button ref={opener} type="button" className="btn" aria-expanded={open} onClick={() => setOpen(o => !o)}><Plus size={14} aria-hidden="true" /> Add a festival</button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.form key="form" className="gig-add-form" onSubmit={submit} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
            <p className="hint">Found a festival online? Paste its link. It goes straight onto the list and fills in by itself.</p>
            <label className="field"><span>Link to the festival</span><input type="url" inputMode="url" name="url" autoComplete="off" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" required /></label>
            <label className="field"><span>Note (optional)</span><textarea rows={3} name="note" maxLength={1000} value={note} onChange={e => setNote(e.target.value)} /></label>
            {error && <p className="form-err" role="alert">{error}</p>}
            <div className="dlg-actions">
              <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Adding…" : "Add festival"}</button>
              <button type="button" className="btn" onClick={close}>Cancel</button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
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
          <p className="view-sub">{runSummary(cloud.festivalStatus, Date.now())}</p>
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
          <ul className="fest-list">
            <AnimatePresence initial={false}>{t.festivals.map(f => <Card key={f.id} f={f} decide={cloud.decideFestival} />)}</AnimatePresence>
          </ul>
        </section>
      ))}
    </div>
  );
}
