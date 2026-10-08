import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { band } from "../band.js";
import { DAILY_SEND_CAP } from "../crm.js";
import { download } from "../store.js";
import { Empty } from "./common.jsx";

// Approved emails waiting to send. Claude sends them after showing you the list and getting a yes.
export default function SendList({ items, setItems, openBlanket, logEvent }) {
  const [copied, setCopied] = useState(false);
  const batch = items.slice(0, DAILY_SEND_CAP);

  const payload = list => ({
    from: band.email,
    exportedAt: new Date().toISOString(),
    count: list.length,
    note: "One separate email per recipient. Send only after the band confirms this list.",
    emails: list.map(q => ({ id: q.id, kind: q.kind, station: q.station, show: q.show, to: q.to, subject: q.subject, body: q.body })),
  });
  const copy = async () => {
    try { await navigator.clipboard.writeText(JSON.stringify(payload(batch), null, 2)); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* blocked */ }
  };
  const remove = id => setItems(list => list.filter(x => x.id + ":" + x.kind !== id));

  return (
    <div className="sendlist">
      <h1 className="view-title">Send list</h1>
      <p className="view-sub">Everything you've approved. Nothing sends from this page.</p>

      <section className="panel sl-how">
        <ol className="steps">
          <li><b>Check</b> every email below and remove anything you're unsure about.</li>
          <li><b>Download or copy</b> today's batch: up to {DAILY_SEND_CAP} emails. Sending steadily, as separate personal emails, keeps you out of spam folders.</li>
          <li><b>Give it to Claude Code</b> and ask it to send. Claude lists every recipient and subject, sends from {band.email} only after you say yes, then updates this site so those stations show as pitched.</li>
        </ol>
        <div className="sl-actions">
          <button className="btn btn-primary" disabled={!batch.length} onClick={() => download(`floodlines-send-list-${new Date().toISOString().slice(0, 10)}.json`, payload(batch))}>
            Download today's batch ({batch.length})
          </button>
          <button className="btn" disabled={!batch.length} onClick={copy}>{copied ? "Copied" : "Copy for Claude"}</button>
          {items.length > DAILY_SEND_CAP && <span className="sl-note">{items.length - DAILY_SEND_CAP} more wait for tomorrow's batch.</span>}
          {items.length > 0 && <button className="btn btn-ghost" onClick={() => { if (confirm("Remove every email from the send list?")) setItems([]); }}>Clear list</button>}
        </div>
      </section>

      {!items.length ? <Empty>Nothing approved yet. Pick stations in All stations and choose Blanket email.</Empty> : (
        <ul className="sl-list">
          <AnimatePresence initial={false}>
            {items.map((q, i) => (
              <motion.li key={q.id + q.kind} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 60 }} className={i >= DAILY_SEND_CAP ? "later" : ""}>
                <details>
                  <summary>
                    <span className="sl-kind">{q.kind === "followup" ? "Follow-up" : "Pitch"}</span>
                    <span className="sl-station">{q.station}{q.show ? ` · ${q.show}` : ""}</span>
                    <span className="sl-to">{q.to}</span>
                    <span className="sl-subject">{q.subject}</span>
                  </summary>
                  <pre className="sl-body">{q.body}</pre>
                </details>
                <div className="sl-row-actions">
                  <button className="btn btn-ghost" onClick={() => openBlanket([q.id], q.kind)}>Edit</button>
                  <button className="btn btn-ghost" onClick={() => { remove(q.id + ":" + q.kind); logEvent(q.id, "note", "Removed from the send list"); }}>Remove</button>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
