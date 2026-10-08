import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLocal } from "../store.js";
import { fmtDate, statuses } from "../crm.js";
import { Gauge, StatusPill, flag, genreLabel, groupLabel, routeLabel, tierLabel, typeLabel } from "./common.jsx";

const defaults = { q: "", group: "all", route: "reachable", genre: "fits", tier: "all", status: "all", type: "all", starred: false, restricted: true };

const views = [
  ["Ready to email", { route: "email", status: "new", genre: "fits" }],
  ["Start here", { tier: "start", status: "new" }],
  ["UK", { group: "uk" }],
  ["Indie & alt specialists", { genre: "indie" }],
  ["Starred", { starred: true }],
  ["Played us", { status: "played" }],
];

const sorters = {
  rank: (a, b) => a.rank - b.rank,
  name: (a, b) => a.name.localeCompare(b.name),
  where: (a, b) => (a.country + a.region).localeCompare(b.country + b.region),
  status: (a, b) => statuses.findIndex(s => s.key === a.rec.status) - statuses.findIndex(s => s.key === b.rec.status),
  last: (a, b) => (b.info.lastAt?.getTime() || 0) - (a.info.lastAt?.getTime() || 0),
};

function toCSV(rows) {
  const cols = ["rank", "name", "show", "contactName", "country", "region", "type", "genres", "route", "email", "formUrl", "tier", "score", "status", "lastContact", "sourceUrl"];
  const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...rows.map(s => cols.map(c => esc(c === "status" ? s.rec.status : c === "lastContact" ? (s.info.lastAt ? s.info.lastAt.toISOString().slice(0, 10) : "") : s[c])).join(","))].join("\n");
}

export default function TableView({ stations, selected, setSelected, openDrawer, openBlanket, setStatus, update }) {
  const [f, setF] = useLocal("fl-filters", defaults);
  const [sort, setSort] = useLocal("fl-sort", "rank");
  const [shown, setShown] = useState(100);
  const [showFilters, setShowFilters] = useState(false);
  const set = patch => { setF(x => ({ ...x, ...patch })); setShown(100); };

  const rows = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    return stations.filter(s =>
      (f.group === "all" || s.group === f.group) &&
      (f.route === "all" || (f.route === "reachable" ? !["contact", "none"].includes(s.route) : s.route === f.route)) &&
      (f.genre === "all" || (f.genre === "fits" ? s.genreFit !== "other" : s.genreFit === f.genre)) &&
      (f.tier === "all" || s.tier === f.tier) &&
      (f.status === "all" || s.rec.status === f.status) &&
      (f.type === "all" || s.type === f.type) &&
      (!f.starred || s.rec.starred) &&
      (f.restricted || !s.restricted) &&
      (!q || `${s.name} ${s.show || ""} ${s.region} ${s.country} ${s.genres || ""} ${s.contactName || ""} ${(s.rec.tags || []).join(" ")}`.toLowerCase().includes(q))
    ).sort(sorters[sort] || sorters.rank);
  }, [stations, f, sort]);

  const selSet = new Set(selected);
  const emailable = selected.filter(id => stations.find(s => s.id === id)?.route === "email");
  const allOnPage = rows.slice(0, shown).map(s => s.id);
  const toggle = id => setSelected(sel => (sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]));
  const Th = ({ k, children, className = "" }) => (
    <th className={className} aria-sort={sort === k ? "ascending" : "none"}>
      {k ? <button className={`th-sort${sort === k ? " on" : ""}`} onClick={() => setSort(k)}>{children}</button> : children}
    </th>
  );

  return (
    <div className="tableview">
      <div className="tv-head">
        <div>
          <h1 className="view-title">All stations</h1>
          <p className="view-sub">{rows.length} of {stations.length} shown. Click a station for its rules, notes and history.</p>
        </div>
        <button className="btn" onClick={() => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([toCSV(rows)], { type: "text/csv" })); a.download = "floodlines-radio-stations.csv"; a.click(); }}>Export these as CSV</button>
      </div>

      <div className="views-row" role="group" aria-label="Saved views">
        <span className="views-label">Quick views</span>
        {views.map(([label, patch]) => (
          <button key={label} className="chip-view" onClick={() => set({ ...defaults, ...patch })}>{label}</button>
        ))}
        <button className="chip-view reset" onClick={() => set(defaults)}>Reset filters</button>
      </div>

      <button className="btn filters-toggle" aria-expanded={showFilters} onClick={() => setShowFilters(v => !v)}>{showFilters ? "Hide filters" : "Filters"}</button>
      <div className={`filters${showFilters ? " is-open" : ""}`}>
        <label className="search"><span className="sr-only">Search</span>
          <input type="search" placeholder="Search name, city, genre, contact or tag" value={f.q} onChange={e => set({ q: e.target.value })} />
        </label>
        <label><span>Region</span>
          <select value={f.group} onChange={e => set({ group: e.target.value })}>
            <option value="all">Everywhere</option>
            {Object.entries(groupLabel).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label><span>Route</span>
          <select value={f.route} onChange={e => set({ route: e.target.value })}>
            <option value="reachable">Any way to apply</option>
            <option value="email">Email</option>
            <option value="form">Form</option>
            <option value="platform">Uploader</option>
            <option value="post">Post</option>
            <option value="contact">General contact only</option>
            <option value="all">Everything, incl. no route</option>
          </select>
        </label>
        <label><span>Genre</span>
          <select value={f.genre} onChange={e => set({ genre: e.target.value })}>
            <option value="fits">Plays indie/alt or any genre</option>
            <option value="indie">Indie/alt/rock specialists</option>
            <option value="any">All genres</option>
            <option value="mixed">Some shows fit</option>
            <option value="all">Every genre, incl. no fit</option>
          </select>
        </label>
        <label><span>Priority</span>
          <select value={f.tier} onChange={e => set({ tier: e.target.value })}>
            <option value="all">Any</option>
            {Object.entries(tierLabel).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label><span>Status</span>
          <select value={f.status} onChange={e => set({ status: e.target.value })}>
            <option value="all">Any</option>
            {statuses.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
        <label><span>Type</span>
          <select value={f.type} onChange={e => set({ type: e.target.value })}>
            <option value="all">Any</option>
            {Object.entries(typeLabel).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label className="check"><input type="checkbox" checked={f.restricted} onChange={e => set({ restricted: e.target.checked })} /> Include local-only stations</label>
        <label className="check"><input type="checkbox" checked={f.starred} onChange={e => set({ starred: e.target.checked })} /> Starred only</label>
      </div>

      <div className="table-wrap">
        <table className="stations">
          <thead>
            <tr>
              <th className="c-check">
                <input type="checkbox" aria-label="Select all shown" checked={allOnPage.length > 0 && allOnPage.every(id => selSet.has(id))} onChange={e => setSelected(e.target.checked ? [...new Set([...selected, ...allOnPage])] : selected.filter(id => !allOnPage.includes(id)))} />
              </th>
              <th className="c-star"><span className="sr-only">Starred</span></th>
              <Th k="rank" className="c-rank">#</Th>
              <Th k="name">Station</Th>
              <Th k="where">Where</Th>
              <th>Genre</th>
              <th>Route</th>
              <th>Priority</th>
              <th className="c-gauges">Chance / value</th>
              <Th k="status">Status</Th>
              <Th k="last">Last contact</Th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, shown).map(s => (
              <tr key={s.id} className={`${selSet.has(s.id) ? "is-sel" : ""}${s.info.isDue ? " is-due" : ""}`}>
                <td className="c-check"><input type="checkbox" checked={selSet.has(s.id)} onChange={() => toggle(s.id)} aria-label={`Select ${s.name}`} /></td>
                <td className="c-star">
                  <button className={`star${s.rec.starred ? " on" : ""}`} aria-pressed={s.rec.starred} aria-label="Star" onClick={() => update(s.id, r => ({ starred: !r.starred }))}>★</button>
                </td>
                <td className="c-rank">{s.score != null ? s.rank : "–"}</td>
                <td className="c-name">
                  <button className="name-btn" onClick={() => openDrawer(s.id)}>
                    <b>{s.name}</b>
                    {s.show && <span>{s.show}</span>}
                    {s.contactName && <span className="contact">{s.contactName}</span>}
                  </button>
                  {s.restricted && <span className="flag-local">Local acts only</span>}
                </td>
                <td className="c-where">{flag(s.country)} {s.region || s.country}<small>{typeLabel[s.type] || s.type}</small></td>
                <td className="c-genre"><span className={`gfit g-${s.genreFit}`}>{genreLabel[s.genreFit]}</span>{s.genres && <small>{s.genres}</small>}</td>
                <td><span className={`route r-${s.route}`}>{routeLabel[s.route]}</span></td>
                <td>{s.tier ? <span className={`tier t-${s.tier}`}>{tierLabel[s.tier]} <b>{s.score}</b></span> : "–"}</td>
                <td className="c-gauges"><Gauge value={s.chance} label="Chance" /><Gauge value={s.value} label="Value" /></td>
                <td><StatusPill status={s.rec.status} />{s.info.isDue && <small className="due">Follow-up due</small>}</td>
                <td className="c-last">{fmtDate(s.info.lastAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > shown && <button className="btn more" onClick={() => setShown(n => n + 150)}>Show more ({rows.length - shown} left)</button>}
      </div>

      <AnimatePresence>
        {selected.length > 0 && (
          <motion.div className="bulkbar" initial={{ y: 120 }} animate={{ y: 0 }} exit={{ y: 120 }} transition={{ type: "spring", stiffness: 300, damping: 28 }}>
            <span className="bulk-n"><b>{selected.length}</b> selected{emailable.length !== selected.length ? `, ${emailable.length} take email` : ""}</span>
            <button className="btn btn-primary" disabled={!emailable.length} onClick={() => openBlanket(emailable, "pitch")}>Blanket email {emailable.length}</button>
            <label className="bulk-status"><span className="sr-only">Move selected to</span>
              <select value="" onChange={e => { if (e.target.value) setStatus(selected, e.target.value); }}>
                <option value="">Move to…</option>
                {statuses.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </label>
            <button className="btn" onClick={() => selected.forEach(id => update(id, { starred: true }))}>Star</button>
            <button className="btn btn-ghost" onClick={() => setSelected([])}>Clear</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
