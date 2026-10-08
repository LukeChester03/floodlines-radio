import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { fmtDate, statuses } from "../crm.js";
import { Gauge, flag, genreLabel, routeLabel, tierLabel, typeLabel } from "./common.jsx";

// Everything about one station: their rules, why it's ranked where it is, your notes and the contact history
export default function StationDrawer({ id, stations, update, setStatus, openBlanket, onClose }) {
  const s = id ? stations.find(x => x.id === id) : null;
  const [notes, setNotes] = useState("");
  const [tag, setTag] = useState("");
  useEffect(() => { setNotes(s?.rec.notes || ""); setTag(""); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!id) return;
    const onKey = e => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [id, onClose]);

  return (
    <AnimatePresence>
      {s && (
        <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="scrim" onClick={onClose} />
          <motion.aside
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label={s.name}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 32 }}
          >
            <div className="dr-head">
              <div>
                <p className="dr-where">{flag(s.country)} {s.region || s.country} · {typeLabel[s.type] || s.type}</p>
                <h2>{s.name}</h2>
                {s.show && <p className="dr-show">{s.show}</p>}
              </div>
              <button className="btn btn-ghost" onClick={onClose}>Close</button>
            </div>

            <div className="dr-grid">
              <div><span>Route</span><b>{routeLabel[s.route]}</b></div>
              <div><span>Genre</span><b>{genreLabel[s.genreFit]}</b>{s.genres && <small>{s.genres}</small>}</div>
              <div><span>Priority</span><b>{s.tier ? `${tierLabel[s.tier]} · ${s.score}/100` : "Not ranked"}</b></div>
              <div><span>Chance</span><Gauge value={s.chance} label="Chance" /></div>
              <div><span>Value</span><Gauge value={s.value} label="Value" /></div>
              <div><span>Contact</span><b>{s.contactName || "Not published"}</b>{s.email && <small>{s.email}</small>}</div>
            </div>

            {s.restricted && <p className="dr-warn">This station says it only takes local acts. You can still try, but expect a no unless you have a local link.</p>}
            {s.reasons.length > 0 && <ul className="dr-reasons">{s.reasons.map(r => <li key={r}>{r}</li>)}</ul>}
            {s.pitchTip && <p className="dr-tip"><b>Tip:</b> {s.pitchTip}</p>}

            <section className="dr-sec">
              <h3>What they ask for</h3>
              <p>{s.instructions || "No instructions published."}</p>
              {s.notes && <p className="dr-muted">{s.notes}</p>}
              <a href={s.sourceUrl} target="_blank" rel="noopener">Their submission page</a>
            </section>

            <div className="dr-actions">
              {s.route === "email" && <button className="btn btn-primary" onClick={() => { onClose(); openBlanket([s.id], s.rec.status === "new" ? "pitch" : "followup"); }}>{s.rec.status === "new" ? "Draft pitch" : "Draft follow-up"}</button>}
              {s.route !== "email" && (s.formUrl || s.sourceUrl) && <a className="btn btn-primary" href={s.formUrl || s.sourceUrl} target="_blank" rel="noopener">{s.route === "platform" ? "Open the uploader" : s.route === "post" ? "See postal details" : "Open their form"}</a>}
              {s.route !== "email" && s.rec.status === "new" && <button className="btn" onClick={() => setStatus([s.id], "pitched")}>I've submitted via their form</button>}
              <button className={`btn${s.rec.starred ? " btn-on" : ""}`} onClick={() => update(s.id, r => ({ starred: !r.starred }))}>{s.rec.starred ? "★ Starred" : "☆ Star"}</button>
            </div>

            <section className="dr-sec">
              <h3>Status</h3>
              <div className="status-row" role="group" aria-label="Status">
                {statuses.map(st => (
                  <button key={st.key} className={`pill st-${st.key}${s.rec.status === st.key ? " is-on" : ""}`} aria-pressed={s.rec.status === st.key} onClick={() => setStatus([s.id], st.key)}>{st.label}</button>
                ))}
              </div>
              {s.info.due && <p className="dr-muted">Next follow-up {s.info.isDue ? "is due now" : `due ${fmtDate(s.info.due)}`}.</p>}
            </section>

            <section className="dr-sec">
              <h3>Tags</h3>
              <div className="tags">
                {(s.rec.tags || []).map(t => (
                  <button key={t} className="tag" onClick={() => update(s.id, r => ({ tags: r.tags.filter(x => x !== t) }))} aria-label={`Remove tag ${t}`}>{t} ×</button>
                ))}
                <form onSubmit={e => { e.preventDefault(); const t = tag.trim(); if (t) update(s.id, r => ({ tags: [...new Set([...(r.tags || []), t])] })); setTag(""); }}>
                  <input value={tag} onChange={e => setTag(e.target.value)} placeholder="Add a tag" aria-label="Add a tag" />
                </form>
              </div>
            </section>

            <section className="dr-sec">
              <h3>Notes</h3>
              <textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)} onBlur={() => notes !== s.rec.notes && update(s.id, { notes })} placeholder="Who you spoke to, what they said, which show played you…" />
            </section>

            <section className="dr-sec">
              <h3>History</h3>
              {s.rec.log.length === 0 ? <p className="dr-muted">No contact yet.</p> : (
                <ol className="timeline">
                  {[...s.rec.log].reverse().map((l, i) => (
                    <li key={i} className={`tl-${l.type}`}><time>{fmtDate(new Date(l.at))}</time> {l.text}</li>
                  ))}
                </ol>
              )}
            </section>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
