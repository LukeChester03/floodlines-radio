import { AnimatePresence, motion } from "motion/react";
import { FIRST_FOLLOW_UP_DAYS, MAX_FOLLOW_UPS, SECOND_FOLLOW_UP_DAYS, fmtDate, gmailThreadUrl, replyGroups } from "../crm.js";
import { Empty, flag } from "../ui/bits.jsx";

const outcomeLabel = { replied: "Replied", bounced: "Bounced", auto: "Auto-reply" };

function ReplyCard({ r, byId, songs, decide, done }) {
  const st = byId[r.stationId];
  const sg = songs.find(x => x.id === r.song);
  const d = r.decision || "undecided";
  return (
    <motion.li layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.2 }} style={{ "--song": sg?.color }}>
      <div className="reply-main">
        <b>{st ? st.name : r.from}</b>
        {sg && <span className="sent-chip">{sg.title}</span>}
        <span className={`tag reply-${r.outcome}`}>{outcomeLabel[r.outcome] || r.outcome}</span>
        <span className="muted">{fmtDate(r.date ? new Date(r.date) : null)}</span>
        <p className="reply-snippet">{r.snippet}</p>
      </div>
      <div className="reply-actions">
        <a className="link-btn" href={gmailThreadUrl(r.threadId)} target="_blank" rel="noreferrer">Open in Gmail<span className="sr-only"> (new tab) for {st ? st.name : r.from}</span></a>
        {done ? (
          <button className="link-btn" onClick={() => decide(r.id, "undecided")}>Undo</button>
        ) : d === "want-reply" ? (
          <button className="btn btn-primary" onClick={() => decide(r.id, "replied-done")}>Replied</button>
        ) : (
          <>
            <button className="btn" onClick={() => decide(r.id, "want-reply")}>Want to reply</button>
            <button className="link-btn" onClick={() => decide(r.id, "no-action")}>No action</button>
          </>
        )}
      </div>
    </motion.li>
  );
}

const chip = ({ song }) => <span key={song.id} className="sent-chip" style={{ "--song": song.color }}>{song.title}</span>;

// Follow-ups for every song, one row per station
export default function Followups({ stations, songs, followups: { due, upcoming }, openMailer, openSheet, setStatus, byId, cloud }) {
  const groups = replyGroups(cloud.replies);
  const decide = cloud.decideReply;
  const open = [...groups.undecided, ...groups.wantReply];
  const movedOn = stations.flatMap(s => (s.rec.dnc ? [] : songs.filter(sg => s.per[sg.id].movedOn).map(sg => ({ s, sg }))));
  const drafts = songs
    .map(sg => ({ sg, ids: due.filter(g => g.station.email && g.songs.some(w => w.song.id === sg.id)).map(g => g.station.id) }))
    .filter(d => d.ids.length);

  return (
    <div className="followups">
      <div className="view-head">
        <div>
          <h2 className="view-title">Follow-ups</h2>
          <p className="view-sub">A one-line nudge {FIRST_FOLLOW_UP_DAYS} days after the pitch, one more {SECOND_FOLLOW_UP_DAYS} days later, then move on. Most plays don't come from a single email. This covers every song.</p>
        </div>
      </div>

      {cloud.replies.length > 0 && (
        <section className="card-panel" aria-labelledby="replies-title">
          <h3 id="replies-title" className="panel-title">Replies <span className="pill-n hot">{groups.undecided.length}</span></h3>
          <p className="panel-sub">Read in Gmail. Say what you want to do with each one; the site never replies for you.</p>
          {open.length === 0 && <p className="muted">Nothing waiting on a decision.</p>}
          <ul className="fu-list reply-list">
            <AnimatePresence initial={false}>
              {open.map(r => <ReplyCard key={r.id} r={r} byId={byId} songs={songs} decide={decide} />)}
            </AnimatePresence>
          </ul>
          {groups.done.length > 0 && (
            <details className="reply-done">
              <summary>Done <span className="pill-n">{groups.done.length}</span></summary>
              <ul className="fu-list quiet reply-list">
                {groups.done.map(r => <ReplyCard key={r.id} r={r} byId={byId} songs={songs} decide={decide} done />)}
              </ul>
            </details>
          )}
        </section>
      )}

      {due.length === 0 ? (
        <section className="card-panel">
          {upcoming.length > 0
            ? <Empty title={`Nothing due yet. Next follow-ups from ${fmtDate(upcoming[0].due)}.`} />
            : <Empty title="No follow-ups due.">They appear here {FIRST_FOLLOW_UP_DAYS} days after each pitch goes out, for every song.</Empty>}
        </section>
      ) : (
        <section className="card-panel">
          <div className="panel-head">
            <div>
              <h3 className="panel-title">Due now <span className="pill-n hot">{due.length}</span></h3>
              <p className="panel-sub">Pitched, no reply, and the wait is up.</p>
            </div>
            <div className="panel-actions">
              {drafts.map(({ sg, ids }) => <button key={sg.id} className="btn btn-primary" onClick={() => openMailer(ids, "followup", sg.id)}>Draft {sg.title} follow-ups ({ids.length})</button>)}
            </div>
          </div>
          <ul className="fu-list">
            {due.map(({ station: s, songs: waiting }, i) => (
              <motion.li key={s.id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                <button className="fu-name" onClick={() => openSheet(s.id)}>{s.name}{s.show ? ` · ${s.show}` : ""}</button>
                <span>{flag(s.country)} {s.region}</span>
                {waiting.map(chip)}
                <span>Last contact {fmtDate(new Date(Math.max(...waiting.map(w => w.lastAt))))}</span>
                <span>Nudge {Math.max(...waiting.map(w => w.followUps)) + 1} of {MAX_FOLLOW_UPS}</span>
                {!s.email && <span className="muted">Reply through their form</span>}
                <button className="link-btn" onClick={() => waiting.forEach(w => setStatus([s.id], "replied", w.song.id))}>They replied</button>
              </motion.li>
            ))}
          </ul>
        </section>
      )}

      <section className="card-panel">
        <h3 className="panel-title">Coming up</h3>
        {upcoming.length === 0 ? <Empty title="Nothing scheduled yet." /> : (
          <ul className="fu-list quiet">
            {upcoming.slice(0, 40).map(({ station: s, songs: waiting, due: next }) => (
              <li key={s.id}>
                <button className="fu-name" onClick={() => openSheet(s.id)}>{s.name}</button>
                {waiting.map(chip)}
                <span>Due {fmtDate(next)}</span>
                <span>Pitched {fmtDate(new Date(Math.min(...waiting.map(w => w.lastAt))))}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {movedOn.length > 0 && (
        <section className="card-panel">
          <h3 className="panel-title">Time to move on <span className="pill-n">{movedOn.length}</span></h3>
          <p className="panel-sub">Pitched and nudged twice with no reply. Mark them as passed for that song, and try them again with your next single.</p>
          <button className="btn" onClick={() => movedOn.forEach(({ s, sg }) => setStatus([s.id], "declined", sg.id))}>Mark all {movedOn.length} as passed</button>
        </section>
      )}
    </div>
  );
}
