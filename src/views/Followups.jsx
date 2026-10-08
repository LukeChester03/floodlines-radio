import { motion } from "motion/react";
import { FIRST_FOLLOW_UP_DAYS, MAX_FOLLOW_UPS, SECOND_FOLLOW_UP_DAYS, fmtDate } from "../crm.js";
import { Empty, StatusTag, flag } from "../ui/bits.jsx";

export default function Followups({ stations, song, due, openMailer, openSheet, setStatus }) {
  const upcoming = stations.filter(s => s.cur.due && !s.cur.isDue && !s.rec.dnc).sort((a, b) => a.cur.due - b.cur.due).slice(0, 40);
  const movedOn = stations.filter(s => s.cur.movedOn && !s.rec.dnc);
  const dueEmail = due.filter(s => s.email).map(s => s.id);

  return (
    <div className="followups">
      <div className="view-head">
        <div>
          <h2 className="view-title">{song.title} follow-ups</h2>
          <p className="view-sub">A one-line nudge {FIRST_FOLLOW_UP_DAYS} days after the pitch, one more {SECOND_FOLLOW_UP_DAYS} days later, then move on. Most plays don't come from a single email.</p>
        </div>
      </div>

      <section className="card-panel">
        <div className="panel-head">
          <div>
            <h3 className="panel-title">Due now <span className="pill-n hot">{due.length}</span></h3>
            <p className="panel-sub">Pitched {song.title}, no reply, and the wait is up.</p>
          </div>
          {dueEmail.length > 0 && <button className="btn btn-primary" onClick={() => openMailer(dueEmail, "followup")}>Draft {dueEmail.length} follow-ups</button>}
        </div>
        {due.length === 0 ? <Empty title="Nothing due.">Follow-ups appear here {FIRST_FOLLOW_UP_DAYS} days after each pitch goes out.</Empty> : (
          <ul className="fu-list">
            {due.map((s, i) => (
              <motion.li key={s.id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                <button className="fu-name" onClick={() => openSheet(s.id)}>{s.name}{s.show ? ` · ${s.show}` : ""}</button>
                <span>{flag(s.country)} {s.region}</span>
                <span>Last contact {fmtDate(s.cur.lastAt)}</span>
                <span>Nudge {s.cur.followUps + 1} of {MAX_FOLLOW_UPS}</span>
                <StatusTag status={s.cur.status} small />
                <button className="link-btn" onClick={() => setStatus([s.id], "replied")}>They replied</button>
              </motion.li>
            ))}
          </ul>
        )}
      </section>

      <section className="card-panel">
        <h3 className="panel-title">Coming up</h3>
        {upcoming.length === 0 ? <Empty title="Nothing scheduled yet." /> : (
          <ul className="fu-list quiet">
            {upcoming.map(s => (
              <li key={s.id}>
                <button className="fu-name" onClick={() => openSheet(s.id)}>{s.name}</button>
                <span>Due {fmtDate(s.cur.due)}</span>
                <StatusTag status={s.cur.status} small />
              </li>
            ))}
          </ul>
        )}
      </section>

      {movedOn.length > 0 && (
        <section className="card-panel">
          <h3 className="panel-title">Time to move on <span className="pill-n">{movedOn.length}</span></h3>
          <p className="panel-sub">Pitched and nudged twice with no reply. Mark them as passed for {song.title}, and try them again with your next single.</p>
          <button className="btn" onClick={() => setStatus(movedOn.map(s => s.id), "declined")}>Mark all {movedOn.length} as passed</button>
        </section>
      )}
    </div>
  );
}
