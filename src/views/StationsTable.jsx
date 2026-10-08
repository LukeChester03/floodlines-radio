import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, Ban, Download, Mail, Search, SlidersHorizontal, Star, X } from "lucide-react";
import { useLocal } from "../store.js";
import { fmtDate, statuses } from "../crm.js";
import { Empty, Meter, StatusTag, flag, genreLabel, groupLabel, routeLabel, tierLabel, typeLabel } from "../ui/bits.jsx";

const defaults = { q: "", group: "all", route: "reachable", genre: "fits", tier: "all", type: "all", status: "all", heard: "all", tag: "all", starred: false };

const filterLabels = {
  group: v => `Region: ${groupLabel[v]}`,
  route: v => `Apply by: ${{ email: "Email", form: "Form", platform: "Uploader", post: "Post", contact: "General contact only", all: "Everything" }[v]}`,
  genre: v => `Genre: ${{ indie: "Indie/alt specialists", any: "All genres", mixed: "Some shows fit", other: "Other genres", all: "Every genre" }[v]}`,
  tier: v => `Priority: ${tierLabel[v]}`,
  type: v => `Type: ${typeLabel[v]}`,
  tag: v => `Tag: ${v}`,
  starred: () => "Starred",
};

const sorters = {
  rank: (a, b) => a.rank - b.rank,
  name: (a, b) => a.name.localeCompare(b.name),
  where: (a, b) => (a.country + a.region).localeCompare(b.country + b.region),
  status: (a, b) => statuses.findIndex(s => s.key === a.cur.status) - statuses.findIndex(s => s.key === b.cur.status) || a.rank - b.rank,
  last: (a, b) => (b.cur.lastAt?.getTime() || 0) - (a.cur.lastAt?.getTime() || 0),
};

function csv(rows, songs) {
  const cols = ["rank", "name", "show", "contactName", "country", "region", "type", "genres", "route", "email", "formUrl", "tier", "score", ...songs.map(s => s.title), "tags", "notes", "sourceUrl"];
  const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols.map(esc).join(","), ...rows.map(r => [r.rank, r.name, r.show, r.contactName, r.country, r.region, r.type, r.genres, r.route, r.email, r.formUrl, r.tier, r.score, ...songs.map(s => r.per[s.id].status), r.rec.tags.join("; "), r.rec.notes, r.sourceUrl].map(esc).join(","))].join("\n");
}

// Sortable column header (defined outside the table so focus survives a re-sort)
function Th({ k, sort, setSort, children, className }) {
  return (
    <th scope="col" className={className} aria-sort={sort === k ? "ascending" : undefined}>
      <button className={`th-btn${sort === k ? " on" : ""}`} onClick={() => setSort(k)}>
        {children}{sort === k && <ArrowDown size={14} aria-hidden="true" />}
      </button>
    </th>
  );
}

const PAGE_PHONE = 40;

export default function StationsTable({ stations, songs, song, selected, setSelected, openSheet, openMailer, setStatus, updateStation }) {
  const [f, setF] = useLocal("fl3-filters", defaults);
  const [sort, setSort] = useLocal("fl2-sort", "rank");
  const [panel, setPanel] = useState(false);
  const [phone, setPhone] = useState(() => window.matchMedia("(max-width: 760px)").matches);
  const [shown, setShown] = useState(PAGE_PHONE);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const on = () => setPhone(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // Changing filters clears the selection, so bulk actions never hit stations you can't see
  const set = patch => { setF(x => ({ ...x, ...patch })); setSelected([]); setShown(PAGE_PHONE); };
  const reset = () => { setF(defaults); setSelected([]); setShown(PAGE_PHONE); };

  const allTags = useMemo(() => [...new Set(stations.flatMap(s => s.rec.tags))].sort(), [stations]);
  const rows = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    const [heardMode, heardSong] = f.heard === "all" ? [null] : f.heard.split(":");
    return stations.filter(s =>
      (f.group === "all" || s.group === f.group) &&
      (f.route === "all" || (f.route === "reachable" ? !["contact", "none"].includes(s.route) : s.route === f.route)) &&
      (f.genre === "all" || (f.genre === "fits" ? s.genreFit !== "other" : s.genreFit === f.genre)) &&
      (f.tier === "all" || s.tier === f.tier) &&
      (f.type === "all" || s.type === f.type) &&
      (f.status === "all" || (f.status === "ready" ? s.cur.status === "new" && !s.cur.queued && !s.rec.dnc : s.cur.status === f.status)) &&
      (!heardMode || (s.per[heardSong] && (heardMode === "has" ? s.per[heardSong].status !== "new" : s.per[heardSong].status === "new"))) &&
      (f.tag === "all" || s.rec.tags.includes(f.tag)) &&
      (!f.starred || s.rec.starred) &&
      (!q || `${s.name} ${s.show || ""} ${s.region} ${s.country} ${s.genres || ""} ${s.contactName || ""} ${s.rec.tags.join(" ")} ${s.rec.notes}`.toLowerCase().includes(q))
    ).sort(sorters[sort] || sorters.rank);
  }, [stations, f, sort]);

  const statusName = v => (v === "ready" ? "Not pitched and not queued" : statuses.find(s => s.key === v)?.label);
  const active = [
    ...Object.keys(filterLabels).filter(k => f[k] !== defaults[k]).map(k => ({ k, label: filterLabels[k](f[k]) })),
    ...(f.status !== "all" ? [{ k: "status", label: `${song.title}: ${statusName(f.status)}` }] : []),
    ...(f.heard !== "all" ? [{ k: "heard", label: (() => { const [m, id] = f.heard.split(":"); const t = songs.find(s => s.id === id)?.title; return m === "has" ? `Has had ${t}` : `Hasn't had ${t}`; })() }] : []),
    ...(f.q ? [{ k: "q", label: `Search: "${f.q}"` }] : []),
  ];
  const hiddenByDefault = stations.length - stations.filter(s => !["contact", "none"].includes(s.route) && s.genreFit !== "other").length;

  const selSet = new Set(selected);
  const selRows = stations.filter(s => selSet.has(s.id));
  const emailable = selRows.filter(s => s.route === "email" && !s.rec.dnc).map(s => s.id);
  const visible = phone ? rows.slice(0, shown) : rows;
  const allIds = rows.map(s => s.id);
  const allOn = allIds.length > 0 && allIds.every(id => selSet.has(id));
  const toggle = id => setSelected(sel => (sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]));

  // Quick views add to the current filters, and show as pressed when they're on
  const views = [
    ["Ready to email", { route: "email", status: "ready" }],
    ["Start here", { tier: "start" }],
    [`Hasn't had ${song.title}`, { heard: `not:${song.id}` }],
    ["UK", { group: "uk" }],
    ["Indie & alt specialists", { genre: "indie" }],
    ["Starred", { starred: true }],
  ];
  const isOn = patch => Object.entries(patch).every(([k, v]) => f[k] === v);
  const toggleView = patch => (isOn(patch) ? set(Object.fromEntries(Object.keys(patch).map(k => [k, defaults[k]]))) : set(patch));

  const bulkDnc = on => {
    const n = selected.length;
    if (on && !confirm(`Mark ${n} ${n === 1 ? "station" : "stations"} as do not contact? They'll be left out of every blanket email until you allow contact again.`)) return;
    selected.forEach(id => updateStation(id, { dnc: on }));
  };

  return (
    <div className="tableview">
      <div className="view-head">
        <div>
          <h2 className="view-title">Station log</h2>
          <p className="view-sub">Every station, with its status for <b>{song.title}</b>. Tick stations to blanket email them, or click a name for rules, notes and history.</p>
        </div>
        <button className="btn" onClick={() => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv(rows, songs)], { type: "text/csv" })); a.download = "floodlines-stations.csv"; a.click(); }}>
          <Download size={16} aria-hidden="true" /> Export CSV
        </button>
      </div>

      <div className="views" role="group" aria-label="Quick views (they combine)">
        {views.map(([label, patch]) => (
          <button key={label} className={`view-chip${isOn(patch) ? " on" : ""}`} aria-pressed={isOn(patch)} onClick={() => toggleView(patch)}>{label}</button>
        ))}
      </div>

      <div className="toolbar">
        <label className="search">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Search stations</span>
          <input type="search" name="search" autoComplete="off" spellCheck={false} placeholder="Search name, city, genre, contact, tag or note…" value={f.q} onChange={e => set({ q: e.target.value })} />
        </label>
        <button className={`btn${panel ? " btn-on" : ""}`} aria-expanded={panel} aria-controls="filter-panel" onClick={() => setPanel(p => !p)}>
          <SlidersHorizontal size={16} aria-hidden="true" /> More filters{active.filter(a => a.k !== "q").length ? ` (${active.filter(a => a.k !== "q").length})` : ""}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {panel && (
          <motion.div id="filter-panel" className="filter-panel" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <div className="filter-grid">
              <label><span>{song.title} status</span>
                <select value={f.status} onChange={e => set({ status: e.target.value })}>
                  <option value="all">Any</option>
                  <option value="ready">Not pitched and not queued</option>
                  {statuses.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </label>
              <label><span>Songs heard</span>
                <select value={f.heard} onChange={e => set({ heard: e.target.value })}>
                  <option value="all">Any</option>
                  {songs.map(s => <option key={"h" + s.id} value={`has:${s.id}`}>Has had {s.title}</option>)}
                  {songs.map(s => <option key={"n" + s.id} value={`not:${s.id}`}>Hasn't had {s.title}</option>)}
                </select>
              </label>
              <label><span>Region</span>
                <select value={f.group} onChange={e => set({ group: e.target.value })}>
                  <option value="all">Everywhere</option>
                  {Object.entries(groupLabel).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </label>
              <label><span>How to apply</span>
                <select value={f.route} onChange={e => set({ route: e.target.value })}>
                  <option value="reachable">Any way to apply</option>
                  <option value="email">Email</option>
                  <option value="form">Form</option>
                  <option value="platform">Uploader</option>
                  <option value="post">Post</option>
                  <option value="contact">General contact only</option>
                  <option value="all">Everything</option>
                </select>
              </label>
              <label><span>Genre</span>
                <select value={f.genre} onChange={e => set({ genre: e.target.value })}>
                  <option value="fits">Indie/alt or any genre</option>
                  <option value="indie">Indie/alt specialists</option>
                  <option value="any">All genres</option>
                  <option value="mixed">Some shows fit</option>
                  <option value="all">Every genre</option>
                </select>
              </label>
              <label><span>Priority</span>
                <select value={f.tier} onChange={e => set({ tier: e.target.value })}>
                  <option value="all">Any</option>
                  {Object.entries(tierLabel).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </label>
              <label><span>Type</span>
                <select value={f.type} onChange={e => set({ type: e.target.value })}>
                  <option value="all">Any</option>
                  {Object.entries(typeLabel).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </label>
              <label><span>Tag</span>
                <select value={f.tag} onChange={e => set({ tag: e.target.value })} disabled={!allTags.length}>
                  <option value="all">{allTags.length ? "Any" : "No tags yet"}</option>
                  {allTags.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="check"><input type="checkbox" checked={f.starred} onChange={e => set({ starred: e.target.checked })} /> Starred only</label>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="showing" aria-live="polite">
        <span><b>{rows.length}</b> of {stations.length} stations</span>
        {active.map(a => (
          <button key={a.k} className="fchip" onClick={() => set({ [a.k]: defaults[a.k] })} aria-label={`Remove filter ${a.label}`}>
            {a.label} <X size={14} aria-hidden="true" />
          </button>
        ))}
        {active.length > 0 && <button className="link-btn" onClick={reset}>Clear all</button>}
        {f.route === "reachable" && f.genre === "fits" && hiddenByDefault > 0 && (
          <button className="link-btn" onClick={() => set({ route: "all", genre: "all" })}>Show the {hiddenByDefault} with no route or other genres</button>
        )}
      </div>

      {rows.length === 0 ? (
        <Empty dark title="No stations match these filters." action={<button className="btn" onClick={reset}>Clear all filters</button>}>Remove a filter above to see more.</Empty>
      ) : (
        <div className="log-wrap">
          <table className="log" aria-label={`Stations, with status for ${song.title}`}>
            <thead>
              <tr>
                <th scope="col" className="c-sel">
                  <input type="checkbox" aria-label={`Select all ${rows.length} shown`} checked={allOn} onChange={e => setSelected(e.target.checked ? [...new Set([...selected, ...allIds])] : selected.filter(id => !allIds.includes(id)))} />
                </th>
                <Th k="rank" sort={sort} setSort={setSort} className="c-rank">#</Th>
                <Th k="name" sort={sort} setSort={setSort} className="c-name">Station</Th>
                <Th k="where" sort={sort} setSort={setSort}>Where</Th>
                <th scope="col">Genre</th>
                <th scope="col">Apply by</th>
                <th scope="col">Priority <span className="th-note">chance · value</span></th>
                <th scope="col">Songs sent</th>
                <Th k="status" sort={sort} setSort={setSort}>{song.title}</Th>
                <Th k="last" sort={sort} setSort={setSort}>Last contact</Th>
              </tr>
            </thead>
            <tbody>
              {visible.map(s => (
                <tr key={s.id} className={`${selSet.has(s.id) ? "sel" : ""}${s.cur.isDue ? " due" : ""}${s.rec.dnc ? " dnc" : ""}`}>
                  <td className="c-sel"><input type="checkbox" checked={selSet.has(s.id)} onChange={() => toggle(s.id)} aria-label={`Select ${s.name}`} /></td>
                  <td className="c-rank" data-label="Rank">{s.score != null ? s.rank : "–"}</td>
                  <td className="c-name">
                    <div className="name-cell">
                      <button className={`star${s.rec.starred ? " on" : ""}`} aria-pressed={s.rec.starred} aria-label={`Star ${s.name}`} onClick={() => updateStation(s.id, r => ({ starred: !r.starred }))}>
                        <Star size={16} fill={s.rec.starred ? "currentColor" : "none"} aria-hidden="true" />
                      </button>
                      <button className="name-btn" onClick={() => openSheet(s.id)}>
                        <b>{s.name}</b>
                        {s.show && <span>{s.show}</span>}
                        {s.contactName && <span className="contact">Contact: {s.contactName}</span>}
                      </button>
                    </div>
                    {s.restricted && <span className="note-tag">Says local acts only</span>}
                    {s.rec.dnc && <span className="note-tag dark">Do not contact</span>}
                  </td>
                  <td data-label="Where">{flag(s.country)} {s.region || s.country}<small>{typeLabel[s.type] || s.type}</small></td>
                  <td data-label="Genre"><span className={`gtag g-${s.genreFit}`}>{genreLabel[s.genreFit]}</span>{s.genres && <small>{s.genres}</small>}</td>
                  <td data-label="Apply by"><span className={`route r-${s.route}`}>{routeLabel[s.route]}</span></td>
                  <td data-label="Priority">
                    {s.tier ? <span className={`tier t-${s.tier}`}>{tierLabel[s.tier]}</span> : "–"}
                    {s.tier && <span className="meters"><Meter value={s.chance} label="Chance of a play" /><Meter value={s.value} label="Value of a play" /></span>}
                  </td>
                  <td data-label="Songs sent" className="c-songs">
                    {songs.filter(sg => s.per[sg.id].status !== "new").map(sg => (
                      <span key={sg.id} className="sent-chip" style={{ "--song": sg.color }} title={`${sg.title}: ${s.per[sg.id].status}`}>{sg.title}</span>
                    ))}
                    {songs.every(sg => s.per[sg.id].status === "new") && <span className="muted">None yet</span>}
                  </td>
                  <td data-label={song.title}>
                    {s.cur.queued && s.cur.status === "new" ? <span className="stag st-queued">In send list</span> : <StatusTag status={s.cur.status} />}
                    {s.cur.isDue && <small className="due-tag">Follow-up due</small>}
                  </td>
                  <td data-label="Last contact" className="c-last">{fmtDate(s.cur.lastAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {phone && rows.length > shown && <button className="btn more" onClick={() => setShown(n => n + PAGE_PHONE)}>Show {Math.min(PAGE_PHONE, rows.length - shown)} more ({rows.length - shown} left)</button>}
        </div>
      )}

      <AnimatePresence>
        {selected.length > 0 && (
          <motion.div className="bulkbar" role="region" aria-label="Selected stations" initial={{ y: 160 }} animate={{ y: 0 }} exit={{ y: 160 }} transition={{ type: "spring", stiffness: 320, damping: 30 }}>
            <span className="bulk-n" aria-live="polite"><b>{selected.length}</b> selected{emailable.length !== selected.length ? ` · ${emailable.length} take email` : ""}</span>
            <button className="btn btn-primary" disabled={!emailable.length} onClick={() => openMailer(emailable, "pitch")}>
              <Mail size={16} aria-hidden="true" /> Blanket email {song.title} to {emailable.length}
            </button>
            <label className="bulk-move"><span className="sr-only">Set {song.title} status for selected</span>
              <select value="" onChange={e => { if (e.target.value) setStatus(selected, e.target.value); }}>
                <option value="">Set {song.title} status…</option>
                {statuses.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </label>
            <button className="btn" onClick={() => selected.forEach(id => updateStation(id, { starred: true }))}><Star size={16} aria-hidden="true" /> Star</button>
            {selRows.some(s => s.rec.dnc)
              ? <button className="btn" onClick={() => bulkDnc(false)}>Allow contact</button>
              : <button className="btn" onClick={() => bulkDnc(true)}><Ban size={16} aria-hidden="true" /> Do not contact</button>}
            <button className="link-btn" onClick={() => setSelected([])}>Clear selection</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
