import { useEffect, useMemo, useState } from "react";
import { MotionConfig, motion, useScroll, useSpring } from "motion/react";
import stations from "./data/stations.json";
import sentLog from "./data/sent-log.json";
import { band, defaultTemplate } from "./band.js";
import { useLocal } from "./store.js";
import Receiver, { Keys, bands } from "./sections/Receiver.jsx";
import Tapes from "./sections/Tapes.jsx";
import Stations from "./sections/Stations.jsx";
import Composer from "./sections/Composer.jsx";
import Queue from "./sections/Queue.jsx";

const routes = [["all", "Any route"], ["email", "Takes email"], ["form", "Form/platform"]];
const types = [["all", "All"], ["student", "Student"], ["college", "College"], ["community", "Community"], ["online", "Online"], ["public", "Public"], ["broadcast", "National/regional"], ["show", "Shows"]];
const fits = [["all", "Any fit"], ["high", "Strong fit"]];

const typeMatch = (s, t) => t === "all" || (t === "broadcast" ? ["national", "regional", "commercial"].includes(s.type) : s.type === t);

export default function App() {
  const [region, setRegion] = useLocal("fl-region", "all");
  const [method, setMethod] = useLocal("fl-method", "email");
  const [type, setType] = useState("all");
  const [fit, setFit] = useState("all");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(40);
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
    email: stations.filter(s => s.emailAllowed).length,
    form: stations.filter(s => !s.emailAllowed && (s.method === "form" || s.method === "platform")).length,
    countries: new Set(stations.map(s => s.country)).size,
  }), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stations.filter(s =>
      (method === "all" || (method === "email" ? s.emailAllowed : !s.emailAllowed && (s.method === "form" || s.method === "platform"))) &&
      typeMatch(s, type) &&
      (fit === "all" || s.fit === "high") &&
      (!q || `${s.name} ${s.show || ""} ${s.region} ${s.country}`.toLowerCase().includes(q))
    );
  }, [method, type, fit, query]);

  const inRegion = useMemo(() => filtered.filter(s => region === "all" || s.group === region), [filtered, region]);
  const counts = useMemo(() => {
    const c = { all: filtered.length };
    bands.forEach(b => b.key !== "all" && (c[b.key] = filtered.filter(s => s.group === b.key).length));
    return c;
  }, [filtered]);

  const resetPage = fn => v => { fn(v); setShown(40); };
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
            <span className="plate-label">Station type</span>
            <Keys options={types} value={type} onChange={resetPage(setType)} label="Station type" />
          </div>
          <div className="control-group">
            <span className="plate-label">Fit</span>
            <Keys options={fits} value={fit} onChange={resetPage(setFit)} label="Fit" />
          </div>
          <label className="control-group lcd-wrap">
            <span className="plate-label">Search</span>
            <input className="lcd" type="search" placeholder="STATION, SHOW OR CITY" value={query} onChange={e => resetPage(setQuery)(e.target.value)} />
          </label>
        </Receiver>
      </div>

      <Tapes stats={stats} />

      <main className="wrap">
        <div className="list-head">
          <h2 className="list-title">{inRegion.length} {inRegion.length === 1 ? "station" : "stations"} on the printout</h2>
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

        <Stations
          list={inRegion}
          shown={shown}
          onMore={() => setShown(n => n + 40)}
          statuses={statuses}
          selected={selected}
          onSelect={toggle}
          onDraft={draftFor}
        />

        <footer className="foot">
          <p>Every station was checked against its own website in October 2026. Only stations that invite email submissions, or publish a dedicated music address, can be pitched by email here. The rest link to their own form or platform.</p>
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
