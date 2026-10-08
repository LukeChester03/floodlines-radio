import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Copy, Download, Trash2 } from "lucide-react";
import { band } from "../songs.js";
import { DAILY_SEND_CAP } from "../crm.js";
import { download } from "../store.js";
import { Empty } from "../ui/bits.jsx";

// Approved emails, every song. Claude sends them after you confirm, then the site marks them pitched.
export default function SendList({ items, setItems, songs, openMailer, logEvent, setView }) {
  const [copied, setCopied] = useState(false);
  const batch = items.slice(0, DAILY_SEND_CAP);
  const songTitle = id => songs.find(s => s.id === id)?.title || id;
  const songColor = id => songs.find(s => s.id === id)?.color;

  const payload = list => ({
    from: band.email,
    exportedAt: new Date().toISOString(),
    count: list.length,
    note: "One separate email per recipient. Send only after the band confirms this list.",
    emails: list.map(q => ({ id: q.id, song: q.song, kind: q.kind, station: q.station, show: q.show, to: q.to, subject: q.subject, body: q.body })),
  });
  const copy = async () => {
    try { await navigator.clipboard.writeText(JSON.stringify(payload(batch), null, 2)); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard blocked */ }
  };
  const key = q => `${q.id}:${q.song}:${q.kind}`;

  return (
    <div className="sendlist">
      <div className="view-head">
        <div>
          <h2 className="view-title">Send list</h2>
          <p className="view-sub">Everything you've approved, for every song. Nothing sends from this page.</p>
        </div>
      </div>

      <section className="card-panel stamp-panel">
        <span className="promo-stamp" aria-hidden="true">Promo · For radio play only</span>
        <ol className="steps">
          <li><b>Check</b> the emails below. Open any to read it, edit it or remove it.</li>
          <li><b>Download or copy</b> today's batch of up to {DAILY_SEND_CAP}. Steady batches of separate, personal emails stay out of spam folders.</li>
          <li><b>Give it to Claude Code</b> and ask it to send. Claude lists every recipient, song and subject, sends from {band.email} only after you say yes, then updates this site so they show as pitched.</li>
        </ol>
        <div className="row-actions">
          <button className="btn btn-primary" disabled={!batch.length} onClick={() => download(`floodlines-send-list-${new Date().toISOString().slice(0, 10)}.json`, payload(batch))}>
            <Download size={16} aria-hidden="true" /> Download today's batch ({batch.length})
          </button>
          <button className="btn" disabled={!batch.length} onClick={copy}><Copy size={16} aria-hidden="true" /> {copied ? "Copied" : "Copy for Claude"}</button>
          {items.length > DAILY_SEND_CAP && <span className="muted">{items.length - DAILY_SEND_CAP} more wait for the next batch.</span>}
          {items.length > 0 && <button className="link-btn danger" onClick={() => { if (confirm(`Remove all ${items.length} emails from the send list?`)) setItems([]); }}><Trash2 size={14} aria-hidden="true" /> Clear list</button>}
        </div>
      </section>

      {!items.length ? (
        <Empty title="Nothing waiting to send." action={<button className="btn" onClick={() => setView("stations")}>Pick stations</button>}>Tick stations in the station log and choose Blanket email.</Empty>
      ) : (
        <ul className="sl-list">
          <AnimatePresence initial={false}>
            {items.map((q, i) => (
              <motion.li key={key(q)} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 60 }} className={i >= DAILY_SEND_CAP ? "later" : ""}>
                <details>
                  <summary>
                    <span className="sl-song" style={{ "--song": songColor(q.song) }}>{songTitle(q.song)}</span>
                    <span className="sl-kind">{q.kind === "followup" ? "Follow-up" : "Pitch"}</span>
                    <span className="sl-station">{q.station}{q.show ? ` · ${q.show}` : ""}</span>
                    <span className="sl-to">{q.to}</span>
                    <span className="sl-subject">{q.subject}</span>
                  </summary>
                  <pre className="sl-body">{q.body}</pre>
                </details>
                <div className="sl-actions">
                  <button className="link-btn" onClick={() => openMailer([q.id], q.kind, q.song)}>Edit</button>
                  <button className="link-btn danger" onClick={() => { setItems(list => list.filter(x => key(x) !== key(q))); logEvent(q.id, q.song, "note", "Removed from the send list"); }}>Remove</button>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
