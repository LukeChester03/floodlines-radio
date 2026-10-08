import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { fmtDate, statuses } from "../crm.js";
import { flag } from "./common.jsx";

// Kanban pipeline. Drag a card into another column to move it.
function Card({ s, onDrop, openDrawer }) {
  const [dragging, setDragging] = useState(false);
  return (
    <motion.li
      layout
      layoutId={`card-${s.id}`}
      className={`card${s.info.isDue ? " is-due" : ""}`}
      drag
      dragSnapToOrigin
      dragElastic={0.6}
      whileDrag={{ scale: 1.05, rotate: -2, zIndex: 20, boxShadow: "0 20px 40px rgba(0,0,0,.4)" }}
      onDragStart={() => setDragging(true)}
      onDragEnd={(e, info) => {
        setTimeout(() => setDragging(false), 50);
        const el = document.elementsFromPoint(info.point.x - window.scrollX, info.point.y - window.scrollY).find(n => n.dataset?.status);
        if (el) onDrop(s.id, el.dataset.status);
      }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
    >
      <button className="card-btn" onClick={() => !dragging && openDrawer(s.id)}>
        <b>{s.name}</b>
        {s.show && <span className="card-show">{s.show}</span>}
        <span className="card-meta">{flag(s.country)} {s.region}{s.info.lastAt ? ` · last ${fmtDate(s.info.lastAt)}` : ""}</span>
        {s.info.isDue && <span className="card-due">Follow-up due</span>}
      </button>
    </motion.li>
  );
}

export default function Board({ stations, setStatus, openDrawer }) {
  const [limit, setLimit] = useState({ new: 25 });
  const reachable = stations.filter(s => !["contact", "none"].includes(s.route) && s.genreFit !== "other");
  const onDrop = (id, status) => {
    const s = stations.find(x => x.id === id);
    if (s && s.rec.status !== status) setStatus([id], status);
  };

  return (
    <div className="board-view">
      <h1 className="view-title">Pipeline</h1>
      <p className="view-sub">Drag a station into the next column as things happen. "Not contacted" shows the highest-ranked first.</p>
      <div className="board">
        {statuses.map(col => {
          const items = reachable.filter(s => s.rec.status === col.key);
          const max = limit[col.key] ?? 60;
          return (
            <section key={col.key} className={`col col-${col.key}`} data-status={col.key} aria-label={col.label}>
              <header className="col-head" data-status={col.key}>
                <h2 data-status={col.key}>{col.label}</h2>
                <span className="col-n" data-status={col.key}>{items.length}</span>
                <p data-status={col.key}>{col.hint}</p>
              </header>
              <ul className="col-list" data-status={col.key}>
                <AnimatePresence initial={false}>
                  {items.slice(0, max).map(s => <Card key={s.id} s={s} onDrop={onDrop} openDrawer={openDrawer} />)}
                </AnimatePresence>
                {!items.length && <li className="col-empty" data-status={col.key}>Drop stations here</li>}
              </ul>
              {items.length > max && <button className="btn btn-ghost more" onClick={() => setLimit(l => ({ ...l, [col.key]: max + 50 }))}>Show more ({items.length - max})</button>}
            </section>
          );
        })}
      </div>
    </div>
  );
}
