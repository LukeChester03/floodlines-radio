import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from "motion/react";
import stations from "./data/stations.json";
import sentLog from "./data/sent-log.json";
import { useLocal } from "./store.js";
import { blank, contactInfo, withSentLog } from "./crm.js";
import Overview from "./views/Overview.jsx";
import TableView from "./views/TableView.jsx";
import Board from "./views/Board.jsx";
import Followups from "./views/Followups.jsx";
import SendList from "./views/SendList.jsx";
import StationDrawer from "./views/StationDrawer.jsx";
import Blanket from "./views/Blanket.jsx";

const byId = Object.fromEntries(stations.map(s => [s.id, s]));

export default function App() {
  const [view, setView] = useLocal("fl-view", "overview");
  const [crmRaw, setCrmRaw] = useLocal("fl-crm", {});
  const [queue, setQueue] = useLocal("fl-sendlist", []);
  const [selected, setSelected] = useState([]);
  const [drawer, setDrawer] = useState(null);
  const [blanket, setBlanket] = useState(null); // { ids, kind }

  const crm = useMemo(() => withSentLog(crmRaw, sentLog), [crmRaw]);
  const update = useCallback((id, fn) => setCrmRaw(c => {
    const cur = withSentLog(c, sentLog)[id] || blank();
    return { ...c, [id]: { ...cur, ...(typeof fn === "function" ? fn(cur) : fn) } };
  }), [setCrmRaw]);
  const logEvent = useCallback((id, type, text) => update(id, r => ({ log: [...r.log, { at: new Date().toISOString(), type, text }] })), [update]);
  const setStatus = useCallback((ids, status) => ids.forEach(id => update(id, r => ({ status, log: [...r.log, { at: new Date().toISOString(), type: "status", text: `Moved to ${status}` }] }))), [update]);

  const enriched = useMemo(() => {
    const now = Date.now();
    return stations.map(s => {
      const r = crm[s.id] || blank();
      return { ...s, rec: r, info: contactInfo(r, now) };
    });
  }, [crm]);
  const due = useMemo(() => enriched.filter(s => s.info.isDue && s.rec.status !== "dnc"), [enriched]);
  const queuedIds = useMemo(() => new Set(queue.map(q => q.id + ":" + q.kind)), [queue]);

  const openBlanket = (ids, kind = "pitch") => {
    const list = ids.filter(id => byId[id]);
    if (list.length) setBlanket({ ids: list, kind });
  };
  const approve = items => {
    setQueue(q => {
      const m = new Map(q.map(x => [x.id + ":" + x.kind, x]));
      items.forEach(x => m.set(x.id + ":" + x.kind, { ...x, approvedAt: new Date().toISOString() }));
      return [...m.values()];
    });
    items.forEach(x => logEvent(x.id, "queued", `${x.kind === "followup" ? "Follow-up" : "Pitch"} added to the send list`));
    setSelected([]);
  };

  const tabs = [
    ["overview", "Overview"],
    ["table", "All stations", stations.length],
    ["board", "Pipeline"],
    ["followups", "Follow-ups", due.length || null],
    ["sendlist", "Send list", queue.length || null],
  ];
  const shared = { stations: enriched, byId, crm, update, setStatus, logEvent, selected, setSelected, openDrawer: setDrawer, openBlanket, queue, queuedIds, due, setView };

  return (
    <MotionConfig reducedMotion="user">
      <div className="app">
        <header className="topbar">
          <button className="mark" onClick={() => setView("overview")}>
            <span className="mark-band">FloodLines</span>
            <span className="mark-sub">Radio flood gauge</span>
          </button>
          <LayoutGroup id="tabs">
            <nav className="tabs" aria-label="Views">
              {tabs.map(([k, label, badge]) => (
                <button key={k} className={`tab${view === k ? " is-on" : ""}`} aria-current={view === k ? "page" : undefined} onClick={() => setView(k)}>
                  {view === k && <motion.span layoutId="tab-water" className="tab-water" transition={{ type: "spring", stiffness: 300, damping: 30 }} />}
                  <span className="tab-label">{label}</span>
                  {badge != null && <span className="tab-badge">{badge}</span>}
                </button>
              ))}
            </nav>
          </LayoutGroup>
        </header>

        <main className="stage">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: [0.2, 0.8, 0.3, 1] }}
            >
              {view === "overview" && <Overview {...shared} />}
              {view === "table" && <TableView {...shared} />}
              {view === "board" && <Board {...shared} />}
              {view === "followups" && <Followups {...shared} />}
              {view === "sendlist" && <SendList {...shared} items={queue} setItems={setQueue} />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <StationDrawer id={drawer} {...shared} onClose={() => setDrawer(null)} />
      <Blanket job={blanket} {...shared} onApprove={approve} onClose={() => setBlanket(null)} />
    </MotionConfig>
  );
}
