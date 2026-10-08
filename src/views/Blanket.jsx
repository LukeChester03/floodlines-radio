import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { band, fill, placeholders, templates as baseTemplates } from "../band.js";
import { useLocal } from "../store.js";
import { DAILY_SEND_CAP, statusLabel } from "../crm.js";

const picks = [["companion", "Companion"], ["finalfear", "Final Fear"], ["both", "Both"]];

// Blanket email: one template, one personal email per station, every one previewed and editable
export default function Blanket({ job, stations, queuedIds, onApprove, onClose }) {
  const kind = job?.kind || "pitch";
  const [tpls, setTpls] = useLocal("fl-templates", baseTemplates);
  const [pick, setPick] = useLocal("fl-pick", "companion");
  const [signoff, setSignoff] = useLocal("fl-signoff", band.signoff);
  const [edits, setEdits] = useState({});
  const [include, setInclude] = useState({});
  const [cursor, setCursor] = useState(0);

  const list = useMemo(() => (job ? job.ids.map(id => stations.find(s => s.id === id)).filter(Boolean) : []), [job, stations]);
  useEffect(() => {
    if (!job) return;
    setEdits({});
    setCursor(0);
    // Leave out anyone marked do-not-contact, and anyone already pitched when this is a first pitch
    setInclude(Object.fromEntries(list.map(s => [s.id, s.email && s.rec.status !== "dnc" && !(kind === "pitch" && s.rec.status !== "new")])));
  }, [job]); // eslint-disable-line react-hooks/exhaustive-deps

  const tpl = tpls[kind] || baseTemplates[kind];
  const draftFor = s => edits[s.id] || fill(tpl, s, pick, signoff);
  const current = list[cursor];
  const draft = current ? draftFor(current) : null;
  const chosen = list.filter(s => include[s.id]);

  const warn = s =>
    !s.email ? "No email address"
    : s.rec.status === "dnc" ? "Marked do not contact"
    : kind === "pitch" && s.rec.status !== "new" ? `Already ${statusLabel[s.rec.status].toLowerCase()}`
    : queuedIds.has(s.id + ":" + kind) ? "Already in the send list (will be replaced)"
    : s.restricted ? "Says local acts only"
    : null;

  const approve = () => {
    onApprove(chosen.map(s => {
      const d = draftFor(s);
      return { id: s.id, kind, station: s.name, show: s.show, to: s.email, subject: d.subject, body: d.body, song: pick };
    }));
    onClose();
  };
  const setTpl = patch => { setTpls(t => ({ ...t, [kind]: { ...tpl, ...patch } })); setEdits({}); };

  return (
    <AnimatePresence>
      {job && current && (
        <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="scrim" onClick={onClose} />
          <motion.section
            className="composer"
            role="dialog"
            aria-modal="true"
            aria-label="Blanket email"
            initial={{ y: 60, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 28 }}
          >
            <header className="cp-head">
              <div>
                <h2>{kind === "followup" ? "Follow-up" : "Blanket email"}: {chosen.length} of {list.length} stations</h2>
                <p>One separate, personal email per station, from {band.email}. Untick anyone you'd rather leave out.</p>
              </div>
              <button className="btn btn-ghost" onClick={onClose}>Close</button>
            </header>

            <div className="cp-body">
              <aside className="cp-recipients" aria-label="Recipients">
                <ul>
                  {list.map((s, i) => {
                    const w = warn(s);
                    return (
                      <li key={s.id} className={`${i === cursor ? "is-on" : ""}${include[s.id] ? "" : " is-off"}`}>
                        <input type="checkbox" checked={!!include[s.id]} disabled={!s.email} onChange={e => setInclude(x => ({ ...x, [s.id]: e.target.checked }))} aria-label={`Include ${s.name}`} />
                        <button onClick={() => setCursor(i)}>
                          <b>{s.name}</b>
                          <span>{s.email || "no email"}</span>
                          {w && <em>{w}</em>}
                          {edits[s.id] && <em className="edited">Edited</em>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </aside>

              <div className="cp-editor">
                <div className="cp-controls">
                  {kind === "pitch" && (
                    <div className="seg" role="group" aria-label="Song">
                      {picks.map(([k, l]) => (
                        <button key={k} aria-pressed={pick === k} onClick={() => { setPick(k); setEdits({}); }}>
                          {pick === k && <motion.span layoutId="song-pill" className="seg-pill" transition={{ type: "spring", stiffness: 300, damping: 28 }} />}
                          <span>{l}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <label className="inline"><span>Signed</span><input value={signoff} onChange={e => { setSignoff(e.target.value); setEdits({}); }} /></label>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div key={current.id} className="letter" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.18 }}>
                    <dl className="envelope">
                      <div><dt>From</dt><dd>{band.email}</dd></div>
                      <div><dt>To</dt><dd>{current.email || "No email address"}{current.contactName ? ` (${current.contactName})` : ""}</dd></div>
                    </dl>
                    {current.instructions && <p className="their-rules"><b>They ask for:</b> {current.instructions}</p>}
                    <label className="field"><span>Subject</span>
                      <input value={draft.subject} onChange={e => setEdits(x => ({ ...x, [current.id]: { ...draft, subject: e.target.value } }))} />
                    </label>
                    <label className="field"><span>Email to {current.name}</span>
                      <textarea rows={14} value={draft.body} onChange={e => setEdits(x => ({ ...x, [current.id]: { ...draft, body: e.target.value } }))} />
                    </label>
                    <div className="cp-pager">
                      <button className="btn btn-ghost" disabled={cursor === 0} onClick={() => setCursor(cursor - 1)}>Previous</button>
                      <span>{cursor + 1} of {list.length}</span>
                      <button className="btn btn-ghost" disabled={cursor === list.length - 1} onClick={() => setCursor(cursor + 1)}>Next</button>
                    </div>
                  </motion.div>
                </AnimatePresence>

                <details className="cp-template">
                  <summary>Edit the template for every {kind === "followup" ? "follow-up" : "pitch"}</summary>
                  <p className="hint">Placeholders: {placeholders.join(" ")}. {"{name}"} uses the music contact's first name when the station publishes one, otherwise "[station] team". Editing resets per-station edits.</p>
                  <label className="field"><span>Subject</span><input value={tpl.subject} onChange={e => setTpl({ subject: e.target.value })} /></label>
                  <label className="field"><span>Body</span><textarea rows={10} value={tpl.body} onChange={e => setTpl({ body: e.target.value })} /></label>
                  <button className="btn btn-ghost" onClick={() => { setTpls(t => ({ ...t, [kind]: baseTemplates[kind] })); setEdits({}); }}>Reset to the original template</button>
                </details>
              </div>
            </div>

            <footer className="cp-foot">
              <button className="btn btn-primary" disabled={!chosen.length} onClick={approve}>Add {chosen.length} to the send list</button>
              <p className="hint">{chosen.length > DAILY_SEND_CAP ? `That's more than ${DAILY_SEND_CAP}, so the send list will split it into daily batches. ` : ""}Nothing sends until you give the list to Claude and confirm.</p>
            </footer>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
