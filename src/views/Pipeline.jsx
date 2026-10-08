import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { GripVertical, Search } from "lucide-react";
import { fmtDate, statuses } from "../crm.js";
import { flag } from "../ui/bits.jsx";

// Board for the current song. Drag a card to another column, or use its menu.
function Card({ s, song, onMove, openSheet }) {
  const [dragging, setDragging] = useState(false);
  return (
    <motion.li
      layout
      className={`kcard${s.cur.isDue ? " due" : ""}`}
      drag
      dragSnapToOrigin
      dragElastic={0.5}
      whileDrag={{ scale: 1.04, rotate: -1.5, zIndex: 30 }}
      onDragStart={() => setDragging(true)}
      onDragEnd={(e, info) => {
        setTimeout(() => setDragging(false), 40);
        const el = document.elementsFromPoint(info.point.x - window.scrollX, info.point.y - window.scrollY).find(n => n.dataset?.col);
        if (el && el.dataset.col !== s.cur.status) onMove(s.id, el.dataset.col);
      }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
    >
      <GripVertical size={16} className="kgrip" aria-hidden="true" />
      <button className="kcard-btn" onClick={() => !dragging && openSheet(s.id)}>
        <b>{s.name}</b>
        {s.show && <span>{s.show}</span>}
        <span className="kmeta">{flag(s.country)} {s.region}{s.cur.lastAt ? ` · ${fmtDate(s.cur.lastAt)}` : ""}</span>
        {s.cur.isDue && <span className="due-tag">Follow-up due</span>}
      </button>
      <label className="kmove">
        <span className="sr-only">Move {s.name} to</span>
        <select value={s.cur.status} onChange={e => onMove(s.id, e.target.value)}>
          {statuses.map(st => <option key={st.key} value={st.key}>{st.label}</option>)}
        </select>
      </label>
    </motion.li>
  );
}

export default function Pipeline({ stations, song, setStatus, openSheet }) {
  const [limit, setLimit] = useState({});
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const reach = stations
    .filter(s => !["contact", "none"].includes(s.route) && s.genreFit !== "other" && !s.rec.dnc)
    .filter(s => !needle || `${s.name} ${s.show || ""} ${s.region} ${s.rec.tags.join(" ")}`.toLowerCase().includes(needle))
    .sort((a, b) => a.rank - b.rank);
  const onMove = (id, status) => setStatus([id], status, song.id);

  return (
    <div className="pipeline">
      <div className="view-head">
        <div>
          <h2 className="view-title">{song.title} pipeline</h2>
          <p className="view-sub">Drag a station into the next column as things happen, or use the menu on each card. Not pitched shows the best-ranked first.</p>
        </div>
      </div>
      <label className="search board-search">
        <Search size={18} aria-hidden="true" />
        <span className="sr-only">Find a station on the board</span>
        <input type="search" name="board-search" autoComplete="off" spellCheck={false} placeholder="Find a station on the board…" value={q} onChange={e => setQ(e.target.value)} />
      </label>
      <div className="board">
        {statuses.map(col => {
          const items = reach.filter(s => s.cur.status === col.key);
          const max = limit[col.key] ?? (col.key === "new" ? 20 : 60);
          return (
            <section key={col.key} className={`col col-${col.key}`} data-col={col.key} aria-label={`${col.label}, ${items.length}`}>
              <header className="col-head" data-col={col.key}>
                <h3 data-col={col.key}>{col.label}</h3>
                <span className="col-n" data-col={col.key}>{items.length}</span>
                <p data-col={col.key}>{col.hint}</p>
              </header>
              <ul className="col-list" data-col={col.key}>
                <AnimatePresence initial={false}>
                  {items.slice(0, max).map(s => <Card key={s.id} s={s} song={song} onMove={onMove} openSheet={openSheet} />)}
                </AnimatePresence>
                {!items.length && <li className="col-empty" data-col={col.key}>Drop stations here</li>}
              </ul>
              {items.length > max && <button className="link-btn more" onClick={() => setLimit(l => ({ ...l, [col.key]: max + 50 }))}>Show {Math.min(50, items.length - max)} more of {items.length - max}</button>}
            </section>
          );
        })}
      </div>
    </div>
  );
}
