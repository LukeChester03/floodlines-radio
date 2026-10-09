import { useEffect, useState } from "react";
import { AnimatePresence, animate, motion } from "motion/react";
import { Pause, RotateCcw, Send, Trash2 } from "lucide-react";
import { band } from "../songs.js";
import { approvalSummary } from "../../functions/approve.js";
import { queueProgress, failureReason } from "../../functions/core/progress.js";
import { sendPace } from "../../functions/core/pace.js";
import { Empty, Modal } from "../ui/bits.jsx";

const STATES = {
  review: "Waiting for review",
  approved: "Approved",
  sending: "Sending",
  sent: "Sent",
  failed: "Failed",
};
const stateOf = q => q.state || "review";

// A number that counts up or down to its new value
function Count({ value }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const c = animate(shown, value, { duration: 0.6, ease: "easeOut", onUpdate: v => setShown(Math.round(v)) });
    return () => c.stop();
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return <>{shown}</>;
}

// Every email waiting to go, for every song. Approve & send hands the reviewed list to the scheduled run.
export default function SendList({ items, cloud, songs, openMailer, logEvent, setView, gmail, gmailStatus }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);
  const songTitle = id => songs.find(s => s.id === id)?.title || id;
  const songColor = id => songs.find(s => s.id === id)?.color;
  const key = q => `${q.id}:${q.song}:${q.kind}`;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  const progress = queueProgress(items, cloud.sends || [], sendPace, now);
  const approved = items.filter(q => stateOf(q) === "approved").map(key);
  const move = async (keys, state) => {
    setError(null);
    try { await cloud.setEntryState(keys, state); } catch { setError("Couldn't update the list. Check your connection and try again."); }
  };
  const nextRun = new Date(progress.nextRunAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const pending = items.filter(q => stateOf(q) === "review");
  const summary = approvalSummary(pending);

  const approve = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await cloud.approveAll(pending.map(key));
      setDone(r.approved);
      setConfirming(false);
    } catch {
      setError("Couldn't approve the list. Check your connection and try again.");
    }
    setBusy(false);
  };

  return (
    <div className="sendlist">
      <div className="view-head">
        <div>
          <h2 className="view-title">Send list</h2>
          <p className="view-sub">Everything queued, for every song. Nothing sends until you approve it.</p>
          {gmail?.kind === "connected" && <p className="view-sub gmail-status">{gmail.text}{gmailStatus?.lastRunAt ? ` · last run ${new Date(gmailStatus.lastRunAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}` : ""}</p>}
        </div>
      </div>

      <section className="card-panel stamp-panel">
        <span className="promo-stamp" aria-hidden="true">Promo · For radio play only</span>
        <ol className="steps">
          <li><b>Check</b> the emails below. Open any to read it, edit it or remove it.</li>
          <li><b>Approve &amp; send.</b> One tap approves everything waiting for review.</li>
          <li><b>It sends gradually</b> from {band.email}, one separate personal email at a time, and the status tags below keep up.</li>
        </ol>
        <div className="row-actions">
          <button className="btn btn-primary" disabled={!pending.length} onClick={() => { setError(null); setConfirming(true); }}>
            <Send size={16} aria-hidden="true" /> Approve &amp; send ({pending.length})
          </button>
          {done != null && <span className="muted" role="status">{done} approved. They'll send gradually.</span>}
          {items.length > 0 && <button className="link-btn danger" onClick={() => { if (confirm(`Remove all ${items.length} emails from the send list? This clears it for the whole band.`)) cloud.removeFromQueue(items.map(key)); }}><Trash2 size={14} aria-hidden="true" /> Clear list</button>}
        </div>
      </section>

      <section className="card-panel progress-panel" aria-label="Send progress">
        <dl className="sl-progress">
          {[["Sent today", <><Count value={progress.sentToday} /> / {progress.cap}</>], ["Approved to go", <Count value={progress.approved} />], ["Sending", <Count value={progress.sending} />], ["Failed", <Count value={progress.failed} />], ["Next run", nextRun]].map(([label, v]) => (
            <div key={label}><dt>{label}</dt><dd>{v}</dd></div>
          ))}
        </dl>
        <div className="sl-bar" role="progressbar" aria-label="Sent today" aria-valuemin={0} aria-valuemax={progress.cap} aria-valuenow={progress.sentToday}>
          <motion.span animate={{ width: `${Math.min(100, (progress.sentToday / (progress.cap || 1)) * 100)}%` }} transition={{ duration: 0.6 }} />
        </div>
        {error && !confirming && <p className="error" role="alert">{error}</p>}
        {approved.length > 0 && <div className="row-actions"><button className="btn" onClick={() => move(approved, "review")}><Pause size={16} aria-hidden="true" /> Pause all ({approved.length})</button></div>}
      </section>

      <Modal open={confirming} onClose={() => !busy && setConfirming(false)} label="Approve and send">
        <h3>Approve {summary.emails} {summary.emails === 1 ? "email" : "emails"}?</h3>
        <p>{summary.emails} separate {summary.emails === 1 ? "email" : "emails"} to {summary.stations} {summary.stations === 1 ? "station" : "stations"}, for {summary.songs.map(songTitle).join(" and ")}.</p>
        <p className="muted">Nothing is sent right now. Approved emails go out gradually from {band.email}.</p>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="row-actions">
          <button className="btn btn-primary" disabled={busy} onClick={approve}>{busy ? "Approving…" : "Approve & send"}</button>
          <button className="btn" disabled={busy} onClick={() => setConfirming(false)}>Cancel</button>
        </div>
      </Modal>

      {!items.length ? (
        <section className="card-panel"><Empty title="Nothing waiting to send." action={<button className="btn" onClick={() => setView("stations")}>Pick stations</button>}>Tick stations in the station log and choose Blanket email.</Empty></section>
      ) : (
        <ul className="sl-list">
          <AnimatePresence initial={false}>
            {items.map(q => (
              <motion.li key={key(q)} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 60 }}>
                <details>
                  <summary>
                    <span className="sl-song" style={{ "--song": songColor(q.song) }}>{songTitle(q.song)}</span>
                    <span className={`sl-state sl-${stateOf(q)}`}>{STATES[stateOf(q)] || stateOf(q)}</span>
                    <span className="sl-kind">{q.kind === "followup" ? "Follow-up" : "Pitch"}</span>
                    <span className="sl-station">{q.station}{q.show ? ` · ${q.show}` : ""}</span>
                    <span className="sl-to">{q.to}</span>
                    <span className="sl-subject">{q.subject}</span>
                  </summary>
                  <pre className="sl-body">{q.body}</pre>
                </details>
                <AnimatePresence initial={false}>
                  {failureReason(q) && (
                    <motion.p key="reason" className="error sl-reason" style={{ overflow: "hidden" }} role="status" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                      Failed: {failureReason(q)}
                    </motion.p>
                  )}
                </AnimatePresence>
                <div className="sl-actions">
                  {stateOf(q) === "review" && <button className="link-btn" onClick={() => openMailer([q.id], q.kind, q.song, { [q.id]: { subject: q.subject, body: q.body } })}>Edit</button>}
                  {stateOf(q) === "approved" && <button className="link-btn" onClick={() => move([key(q)], "review")}><Pause size={14} aria-hidden="true" /> Pause</button>}
                  {stateOf(q) === "failed" && <button className="link-btn" onClick={() => move([key(q)], "approved")}><RotateCcw size={14} aria-hidden="true" /> Retry</button>}
                  <button className="link-btn danger" onClick={() => { cloud.removeFromQueue([key(q)]); logEvent(q.id, q.song, "note", "Removed from the send list"); }}>Remove</button>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
