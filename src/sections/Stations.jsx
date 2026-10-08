import { AnimatePresence, motion } from "motion/react";

const methodLabel = { email: "Email", form: "Form", platform: "Platform", post: "Post", "none-found": "No route found" };
const typeLabel = { national: "National", regional: "Regional", community: "Community", student: "Student", college: "College", public: "Public", online: "Online", commercial: "Commercial", show: "Show" };

// One line of the dot-matrix printout. It "prints" in from the top, line by line.
function Row({ s, i, status, selected, onSelect, onDraft }) {
  const canEmail = s.emailAllowed;
  return (
    <motion.li
      layout="position"
      className={`row fit-${s.fit}${selected ? " is-selected" : ""}`}
      initial={{ clipPath: "inset(0 0 100% 0)", opacity: 0.4 }}
      animate={{ clipPath: "inset(0 0 0% 0)", opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      transition={{ duration: 0.35, ease: "linear", delay: Math.min(i % 40, 14) * 0.045 }}
    >
      <label className="row-check">
        <input type="checkbox" checked={selected} disabled={!canEmail} onChange={() => onSelect(s.id)} aria-label={`Select ${s.name}`} />
        <span aria-hidden="true">{selected ? "[x]" : canEmail ? "[ ]" : "   "}</span>
      </label>

      <div className="row-main">
        <h3 className="row-name">
          {s.name}
          {s.show && <span className="row-show"> / {s.show}</span>}
        </h3>
        <p className="row-meta">
          {s.region || s.country} ({s.country}) . {typeLabel[s.type] || s.type}
          {s.fit === "high" && <b className="row-fit"> . STRONG FIT</b>}
          {s.paid && <b className="row-paid"> . PAID ROUTE</b>}
        </p>
        {s.instructions && <p className="row-how">{s.instructions}</p>}
        {s.notes && <p className="row-notes">NOTE: {s.notes}</p>}
      </div>

      <div className="row-side">
        <span className={`stamp${canEmail ? " stamp-email" : ""}`}>{canEmail ? "Takes email" : s.method === "email" ? "General contact only" : methodLabel[s.method]}</span>
        {status && <span className={`stamp stamp-${status}`}>{status === "sent" ? "Sent" : "Approved"}</span>}
        <div className="row-actions">
          {canEmail && (
            <motion.button className="chip" onClick={() => onDraft([s.id])} whileTap={{ scale: 0.92 }} whileHover={{ y: -2 }}>
              {status ? "Edit pitch" : "Draft pitch"}
            </motion.button>
          )}
          {!canEmail && s.formUrl && <a className="chip" href={s.formUrl} target="_blank" rel="noopener">Open their form</a>}
          <a className="row-link" href={s.sourceUrl} target="_blank" rel="noopener">Their submission page</a>
        </div>
      </div>
    </motion.li>
  );
}

export default function Stations({ list, shown, onMore, statuses, selected, onSelect, onDraft }) {
  const visible = list.slice(0, shown);
  return (
    <div className="printer">
      <div className="printer-slot" aria-hidden="true"><span /></div>
      <div className="paper">
        {list.length === 0 ? (
          <p className="paper-empty">*** NO STATIONS MATCH. TRY ANOTHER REGION OR CLEAR THE FILTERS. ***</p>
        ) : (
          <motion.ul className="rows" layout>
            <AnimatePresence initial={false} mode="popLayout">
              {visible.map((s, i) => (
                <Row key={s.id} s={s} i={i} status={statuses[s.id]} selected={selected.includes(s.id)} onSelect={onSelect} onDraft={onDraft} />
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
        {list.length > shown && (
          <motion.button className="feed" onClick={onMore} whileTap={{ scale: 0.97 }}>
            Print 40 more ({list.length - shown} left)
          </motion.button>
        )}
        <p className="paper-end">*** END OF PRINTOUT: {Math.min(shown, list.length)} OF {list.length} ***</p>
      </div>
    </div>
  );
}
