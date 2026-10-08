import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { download } from "../store.js";
import { Reel } from "./Tapes.jsx";

// The approved send list as a mixtape. Exported as JSON for Claude, who reads it back and asks before sending.
export default function Queue({ items, sentIds, onRemove, onEdit, onClear }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const pending = items.filter(q => !sentIds.has(q.id));

  const payload = () => ({
    from: "floodlinesbanduk@gmail.com",
    exportedAt: new Date().toISOString(),
    count: pending.length,
    emails: pending.map(q => ({ id: q.id, station: q.station, show: q.show, to: q.to, subject: q.subject, body: q.body })),
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload(), null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked */ }
  };

  return (
    <>
      <motion.button
        className="mixtape-tab"
        onClick={() => setOpen(true)}
        animate={{ y: pending.length ? 0 : 200, opacity: pending.length ? 1 : 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 20 }}
        whileHover={{ y: -6, rotate: -2 }}
        aria-hidden={!pending.length}
        tabIndex={pending.length ? 0 : -1}
      >
        <span className="mini-tape">
          <Reel spinning={pending.length > 0} />
          <motion.span key={pending.length} className="mini-count" initial={{ scale: 1.8 }} animate={{ scale: 1 }}>{pending.length}</motion.span>
          <Reel spinning={pending.length > 0} />
        </span>
        <span className="mixtape-text">Mixtape: {pending.length} {pending.length === 1 ? "pitch" : "pitches"} ready</span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="scrim" onClick={() => setOpen(false)} />
            <motion.aside
              className="jcard"
              role="dialog"
              aria-modal="true"
              aria-label="Send list"
              initial={{ y: "110%", rotate: 3 }}
              animate={{ y: 0, rotate: 0 }}
              exit={{ y: "110%", rotate: -3 }}
              transition={{ type: "spring", stiffness: 160, damping: 22 }}
            >
              <div className="jcard-spine">FloodLines . Send list . {pending.length} tracks</div>
              <div className="jcard-body">
                <div className="jcard-head">
                  <h2>Send list</h2>
                  <button className="chip" onClick={() => setOpen(false)}>Close</button>
                </div>
                <ol className="howto">
                  <li>Check every email below. Edit or remove any you're not happy with.</li>
                  <li>Download the send list, or copy it.</li>
                  <li>Give it to Claude Code and ask it to send them. Claude lists every recipient and subject from floodlinesbanduk@gmail.com and waits for your yes before sending.</li>
                </ol>
                <div className="jcard-actions">
                  <motion.button className="chip chip-go" disabled={!pending.length} onClick={() => download(`floodlines-send-list-${new Date().toISOString().slice(0, 10)}.json`, payload())} whileTap={{ scale: 0.95 }}>
                    Download send list ({pending.length})
                  </motion.button>
                  <motion.button className="chip" disabled={!pending.length} onClick={copy} whileTap={{ scale: 0.95 }}>
                    {copied ? "Copied" : "Copy for Claude"}
                  </motion.button>
                  {items.length > 0 && <button className="chip chip-danger" onClick={() => { if (confirm("Remove every approved pitch from the list?")) onClear(); }}>Clear list</button>}
                </div>

                <ol className="tracks">
                  <AnimatePresence initial={false}>
                    {items.map(q => {
                      const sent = sentIds.has(q.id);
                      return (
                        <motion.li key={q.id} layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 60 }} className={sent ? "is-sent" : ""}>
                          <details>
                            <summary>
                              <span className="t-station">{q.station}{q.show ? ` / ${q.show}` : ""}</span>
                              <span className="t-to">{q.to}</span>
                              <span className="t-subject">{q.subject}</span>
                              {sent && <span className="stamp stamp-sent">Sent</span>}
                            </summary>
                            <pre className="t-body">{q.body}</pre>
                          </details>
                          {!sent && (
                            <div className="t-actions">
                              <button className="chip" onClick={() => { setOpen(false); onEdit(q.id); }}>Edit</button>
                              <button className="chip chip-danger" onClick={() => onRemove(q.id)}>Remove</button>
                            </div>
                          )}
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ol>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
