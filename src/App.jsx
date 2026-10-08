import { useEffect, useMemo, useState } from "react";
import { MotionConfig, motion, useScroll, useSpring } from "motion/react";
import stations from "./data/stations.json";
import sentLog from "./data/sent-log.json";
import { band, defaultTemplate } from "./band.js";
import { useLocal } from "./store.js";
import Receiver, { Keys, bands } from "./sections/Receiver.jsx";
import Tapes from "./sections/Tapes.jsx";
import Chart from "./sections/Chart.jsx";
import Standing from "./sections/Standing.jsx";
import Composer from "./sections/Composer.jsx";
import Queue from "./sections/Queue.jsx";

const routes = [["all", "Any route"], ["email", "Takes email"], ["form", "Form/platform"]];
const groupings = [["tier", "By priority"], ["category", "By type of station"]];

export default function App() {
  const [region, setRegion] = useLocal("fl-region", "all");
  const [method, setMethod] = useLocal("fl-method", "email");
  const [groupBy, setGroupBy] = useLocal("fl-groupby", "tier");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState([]);
  const [composing, setComposing] = useState(null);
  const [powered, setPowered] = useState(false);
  const [queue, setQueue] = useLocal("fl-queue", []);
  const [template, setTemplate] = useLocal("fl-template", defaultTemplate);
  const [signoff, setSignoff] = useLocal("fl-signoff", band.signoff);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 200, damping: 40 });

  useEffect(() => { const t = setTimeout(() => setPowered(true), 350); return () => clearTimeout(t); }, []);

  const sentIds = useMemo(() => new Set(sentLog.map(s => s.id)), []);
  const statuses = useMemo(() => {
    const m = {};
    queue.forEach(q => (m[q.id] = "approved"));
    sentLog.forEach(s => (m[s.id] = "sent"));
    return m;
  }, [queue]);

  const stats = useMemo(() => ({
    total: stations.length,
    start: stations.filter(s => s.tier === "start").length,
    email: stations.filter(s => s.emailAllowed).length,
    countries: new Set(stations.map(s => s.country)).size,
  }), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stations.filter(s =>
      (method === "all" || (method === "email" ? s.emailAllowed : !s.emailAllowed)) &&
      (!q || `${s.name} ${s.show || ""} ${s.region} ${s.country}`.toLowerCase().includes(q))
    );
  }, [method, query]);

  const inRegion = useMemo(() => filtered.filter(s => region === "all" || s.group === region), [filtered, region]);
  const counts = useMemo(() => {
    const c = { all: filtered.length };
    bands.forEach(b => b.key !== "all" && (c[b.key] = filtered.filter(s => s.group === b.key).length));
    return c;
  }, [filtered]);

  const resetPage = fn => v => fn(v);
  const toggle = id => setSelected(sel => (sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]));
  const selectable = inRegion.filter(s => s.emailAllowed && !statuses[s.id]);
  const draftFor = ids => setComposing(ids.map(id => stations.find(s => s.id === id)).filter(s => s && s.emailAllowed));

  const approve = list => {
    setQueue(q => {
      const map = new Map(q.map(x => [x.id, x]));
      list.forEach(x => map.set(x.id, { ...x, approvedAt: new Date().toISOString() }));
      return [...map.values()];
    });
    setSelected(sel => sel.filter(id => !list.some(x => x.id === id)));
  };
  const drafts = useMemo(() => Object.fromEntries(queue.map(q => [q.id, q])), [queue]);

  return (
    <MotionConfig reducedMotion="user">
      <motion.div className="progress" style={{ scaleX: progress }} aria-hidden="true" />

      <div className="stack">
        <Receiver region={region} onRegion={resetPage(setRegion)} counts={counts} powered={powered}>
          <div className="control-group">
            <span className="plate-label">Route</span>
            <Keys options={routes} value={method} onChange={resetPage(setMethod)} label="Submission route" />
          </div>
          <div className="control-group">
            <span className="plate-label">Group the chart</span>
            <Keys options={groupings} value={groupBy} onChange={setGroupBy} label="Group the chart" />
          </div>
          <label className="control-group lcd-wrap">
            <span className="plate-label">Search</span>
            <input className="lcd" type="search" placeholder="STATION, SHOW OR CITY" value={query} onChange={e => resetPage(setQuery)(e.target.value)} />
          </label>
        </Receiver>
      </div>

      <Tapes stats={stats} />
      <Standing />

      <main className="wrap">
        <div className="list-head">
          <div>
            <h2 className="list-title">The FloodLines Radio Chart</h2>
            <p className="list-sub">{inRegion.length} stations you can apply to{region !== "all" ? " in this region" : ""}, highest score first.</p>
          </div>
          <div className="bulk">
            <button className="chip" disabled={!selectable.length} onClick={() => setSelected(selectable.map(s => s.id))}>
              Select all that take email ({selectable.length})
            </button>
            {selected.length > 0 && <button className="chip" onClick={() => setSelected([])}>Clear selection</button>}
            <motion.button className="chip chip-go" disabled={!selected.length} onClick={() => draftFor(selected)} whileTap={{ scale: 0.95 }}>
              Draft {selected.length || ""} {selected.length === 1 ? "pitch" : "pitches"}
            </motion.button>
          </div>
        </div>

        <Chart list={inRegion} groupBy={groupBy} statuses={statuses} selected={selected} onSelect={toggle} onDraft={draftFor} />

        <footer className="foot">
          <p>Every station was checked against its own website in October 2026, then ranked by hand for where FloodLines are now. Stations that only list a general contact address, or only take acts from somewhere you're not, are left off. Only stations that invite email submissions can be pitched by email here; the rest link to their own form, uploader or postal address.</p>
          <p>Approved pitches are saved in this browser. Nothing sends from this page. Claude sends them from {band.email} only after you confirm the list.</p>
        </footer>
      </main>

      <Composer
        open={!!composing}
        stations={composing || []}
        template={template}
        setTemplate={setTemplate}
        drafts={drafts}
        onApprove={approve}
        onClose={() => setComposing(null)}
        signoff={signoff}
        setSignoff={setSignoff}
      />
      <Queue
        items={queue}
        sentIds={sentIds}
        onRemove={id => setQueue(q => q.filter(x => x.id !== id))}
        onEdit={id => draftFor([id])}
        onClear={() => setQueue(q => q.filter(x => sentIds.has(x.id)))}
      />
    </MotionConfig>
  );
}
