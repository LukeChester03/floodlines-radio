import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { fill } from "../band.js";
import { Keys } from "./Receiver.jsx";

const picks = [["companion", "Companion"], ["finalfear", "Final Fear"], ["both", "Both"]];

// Types the text out like an old terminal, then hands over to the editable field
function useTyped(text, key) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? Infinity : 0);
  useEffect(() => {
    if (reduce) return;
    setN(0);
    const start = performance.now();
    let raf;
    const tick = now => {
      const next = Math.floor((now - start) / 1000 * 1400);
      setN(next);
      if (next < text.length) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return n >= text.length ? null : text.slice(0, n);
}

// The pitch editor, styled as a green-screen terminal
export default function Composer({ open, stations, template, setTemplate, drafts, onApprove, onClose, signoff, setSignoff }) {
  const [pick, setPick] = useState("companion");
  const [index, setIndex] = useState(0);
  const [edits, setEdits] = useState({});

  useEffect(() => { if (open) { setIndex(0); setEdits({}); } }, [open, stations]);

  const current = stations[index];
  const generated = useMemo(() => (current ? fill(template, current, pick, signoff) : null), [current, template, pick, signoff]);
  const draft = current ? edits[current.id] || drafts[current.id] || { ...generated, pick } : null;
  const typing = useTyped(draft ? draft.body : "", `${current?.id}-${pick}-${open}`);

  const setDraft = patch => setEdits(e => ({ ...e, [current.id]: { ...draft, ...patch } }));
  const approve = all => {
    const list = all ? stations : [current];
    onApprove(list.map(s => {
      const d = edits[s.id] || drafts[s.id] || { ...fill(template, s, pick, signoff), pick };
      return { id: s.id, station: s.name, show: s.show, to: s.email, subject: d.subject, body: d.body, pick: d.pick || pick };
    }));
    if (!all && index < stations.length - 1) setIndex(index + 1);
    else onClose();
  };

  return (
    <AnimatePresence>
      {open && current && (
        <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="scrim" onClick={onClose} />
          <motion.aside
            className="crt"
            role="dialog"
            aria-modal="true"
            aria-label="Draft pitch"
            initial={{ scaleY: 0.004, scaleX: 0.6, opacity: 0.9 }}
            animate={{ scaleY: 1, scaleX: 1, opacity: 1 }}
            exit={{ scaleY: 0.004, scaleX: 0.8, opacity: 0, transition: { duration: 0.25 } }}
            transition={{ scaleY: { duration: 0.35, ease: [0.2, 0.9, 0.3, 1] }, scaleX: { duration: 0.2 } }}
          >
            <div className="crt-screen">
              <div className="crt-head">
                <span>PITCH.EXE {stations.length > 1 ? `[${index + 1}/${stations.length}]` : ""}</span>
                <button className="term-btn" onClick={onClose}>[ESC] Close</button>
              </div>

              {stations.length > 1 && (
                <div className="crt-pager">
                  <button className="term-btn" disabled={index === 0} onClick={() => setIndex(index - 1)}>&lt; Previous</button>
                  <button className="term-btn" disabled={index === stations.length - 1} onClick={() => setIndex(index + 1)}>Next &gt;</button>
                </div>
              )}

              <div className="crt-row">
                <span className="crt-label">Song</span>
                <Keys options={picks} value={pick} onChange={k => { setPick(k); setEdits({}); }} label="Song to pitch" />
              </div>
              <label className="crt-row">
                <span className="crt-label">Signed</span>
                <input className="term-input short" value={signoff} onChange={e => { setSignoff(e.target.value); setEdits({}); }} />
              </label>

              <dl className="crt-env">
                <div><dt>FROM</dt><dd>floodlinesbanduk@gmail.com</dd></div>
                <div><dt>TO</dt><dd>{current.email}</dd></div>
                <div><dt>STATION</dt><dd>{current.name}{current.show ? ` / ${current.show}` : ""}</dd></div>
              </dl>
              {current.instructions && <p className="crt-rules">&gt; THEY ASK FOR: {current.instructions}</p>}

              <label className="crt-field">
                <span className="crt-label">Subject</span>
                <input className="term-input" value={draft.subject} onChange={e => setDraft({ subject: e.target.value })} />
              </label>
              <label className="crt-field">
                <span className="crt-label">Email</span>
                {typing !== null ? (
                  <pre className="term-area typing" aria-hidden="true">{typing}<span className="cursor" /></pre>
                ) : (
                  <textarea className="term-area" rows={15} value={draft.body} onChange={e => setDraft({ body: e.target.value })} />
                )}
              </label>

              <details className="crt-template">
                <summary>&gt; Edit the template for every pitch</summary>
                <p className="crt-hint">Placeholders: {"{name} {target} {song} {songDescriptor} {songBlurb} {links} {signoff}"}. Changing the template resets unsaved edits.</p>
                <label className="crt-field">
                  <span className="crt-label">Subject template</span>
                  <input className="term-input" value={template.subject} onChange={e => { setTemplate({ ...template, subject: e.target.value }); setEdits({}); }} />
                </label>
                <label className="crt-field">
                  <span className="crt-label">Body template</span>
                  <textarea className="term-area" rows={10} value={template.body} onChange={e => { setTemplate({ ...template, body: e.target.value }); setEdits({}); }} />
                </label>
              </details>

              <div className="crt-foot">
                <motion.button className="term-btn term-go" onClick={() => approve(false)} whileTap={{ scale: 0.95 }}>
                  [ENTER] Approve this pitch
                </motion.button>
                {stations.length > 1 && (
                  <motion.button className="term-btn" onClick={() => approve(true)} whileTap={{ scale: 0.95 }}>
                    Approve all {stations.length}
                  </motion.button>
                )}
                <p className="crt-hint">Approving adds it to your mixtape send list. Nothing sends until you give the list to Claude and confirm.</p>
              </div>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
