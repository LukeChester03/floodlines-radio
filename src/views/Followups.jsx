import { motion } from "motion/react";
import { FIRST_FOLLOW_UP_DAYS, MAX_FOLLOW_UPS, SECOND_FOLLOW_UP_DAYS, fmtDate } from "../crm.js";
import { Empty, StatusPill, flag } from "./common.jsx";

export default function Followups({ stations, due, openBlanket, openDrawer, setStatus }) {
  const upcoming = stations
    .filter(s => s.info.due && !s.info.isDue && s.rec.status !== "dnc")
    .sort((a, b) => a.info.due - b.info.due)
    .slice(0, 30);
  const movedOn = stations.filter(s => s.info.movedOn);
  const dueEmail = due.filter(s => s.route === "email" || s.email).map(s => s.id);

  return (
    <div className="followups">
      <h1 className="view-title">Follow-ups</h1>
      <p className="view-sub">
        The rhythm radio promoters recommend: a one-line nudge {FIRST_FOLLOW_UP_DAYS} days after the pitch, one more {SECOND_FOLLOW_UP_DAYS} days later, then move on. Most adds don't come from a single email.
      </p>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Due now <span className="count">{due.length}</span></h2>
            <p>No reply yet and the wait is up.</p>
          </div>
          {dueEmail.length > 0 && <button className="btn btn-primary" onClick={() => openBlanket(dueEmail, "followup")}>Draft {dueEmail.length} follow-ups</button>}
        </div>
        {due.length === 0 ? <Empty>Nothing due. Follow-ups appear here {FIRST_FOLLOW_UP_DAYS} days after each pitch is sent.</Empty> : (
          <ul className="fu-list">
            {due.map((s, i) => (
              <motion.li key={s.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                <button className="fu-name" onClick={() => openDrawer(s.id)}>{s.name}{s.show ? ` · ${s.show}` : ""}</button>
                <span>{flag(s.country)} {s.region}</span>
                <span>Last contact {fmtDate(s.info.lastAt)}</span>
                <span>Follow-up {s.info.followUps + 1} of {MAX_FOLLOW_UPS}</span>
                <StatusPill status={s.rec.status} />
                <button className="btn btn-ghost" onClick={() => setStatus([s.id], "replied")}>They replied</button>
              </motion.li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>Coming up</h2>
        {upcoming.length === 0 ? <Empty>Nothing scheduled yet.</Empty> : (
          <ul className="fu-list quiet">
            {upcoming.map(s => (
              <li key={s.id}>
                <button className="fu-name" onClick={() => openDrawer(s.id)}>{s.name}</button>
                <span>Due {fmtDate(s.info.due)}</span>
                <StatusPill status={s.rec.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {movedOn.length > 0 && (
        <section className="panel">
          <h2>Time to move on <span className="count">{movedOn.length}</span></h2>
          <p>Pitched and followed up twice with no reply. Mark them "Not for them" for now and try again with your next single.</p>
          <button className="btn" onClick={() => setStatus(movedOn.map(s => s.id), "declined")}>Mark all {movedOn.length} as not for them</button>
        </section>
      )}
    </div>
  );
}
