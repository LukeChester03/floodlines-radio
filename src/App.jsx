import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from "motion/react";
import { CalendarClock, KanbanSquare, LayoutDashboard, Mail, Table2 } from "lucide-react";
import stations from "./data/stations.json";
import sentLog from "./data/sent-log.json";
import { useLocal } from "./store.js";
import { defaultSongs } from "./songs.js";
import { blankSong, blankStation, migrate, songInfo, withSentLog } from "./crm.js";
import { OnAir } from "./ui/bits.jsx";
import NowPitching from "./views/NowPitching.jsx";
import Booth from "./views/Booth.jsx";
import StationsTable from "./views/StationsTable.jsx";
import Pipeline from "./views/Pipeline.jsx";
import Followups from "./views/Followups.jsx";
import SendList from "./views/SendList.jsx";
import StationSheet from "./views/StationSheet.jsx";
import Mailer from "./views/Mailer.jsx";
import SongForm from "./views/SongForm.jsx";

const byId = Object.fromEntries(stations.map(s => [s.id, s]));
const nav = [
  ["booth", "The booth", LayoutDashboard],
  ["stations", "Stations", Table2],
  ["pipeline", "Pipeline", KanbanSquare],
  ["followups", "Follow-ups", CalendarClock],
  ["sendlist", "Send list", Mail],
];

export default function App() {
  const [view, setView] = useLocal("fl2-view", "booth");
  const [songs, setSongs] = useLocal("fl2-songs", defaultSongs);
  const [songId, setSongId] = useLocal("fl2-song", "companion");
  const [crmRaw, setCrmRaw] = useLocal("fl-crm", {});
  const [queue, setQueue] = useLocal("fl2-sendlist", []);
  const [selected, setSelected] = useState([]);
  const [sheet, setSheet] = useState(null);
  const [mailer, setMailer] = useState(null); // { ids, kind }
  const [songForm, setSongForm] = useState(null); // null | "new" | song

  const song = songs.find(s => s.id === songId) || songs[0];
  const crm = useMemo(() => withSentLog(migrate(crmRaw), sentLog), [crmRaw]);

  const updateStation = useCallback((id, patch) => setCrmRaw(raw => {
    const cur = withSentLog(migrate(raw), sentLog)[id] || blankStation();
    return { ...migrate(raw), [id]: { ...cur, ...(typeof patch === "function" ? patch(cur) : patch) } };
  }), [setCrmRaw]);
  const updateSong = useCallback((id, sid, patch) => updateStation(id, st => {
    const cur = st.songs[sid] || blankSong();
    return { songs: { ...st.songs, [sid]: { ...cur, ...(typeof patch === "function" ? patch(cur) : patch) } } };
  }), [updateStation]);
  const setStatus = useCallback((ids, status, sid = song.id) => ids.forEach(id => updateSong(id, sid, r => ({
    status,
    log: [...r.log, { at: new Date().toISOString(), type: "status", text: `Moved to ${status}` }],
  }))), [updateSong, song.id]);
  const logEvent = useCallback((id, sid, type, text) => updateSong(id, sid, r => ({ log: [...r.log, { at: new Date().toISOString(), type, text }] })), [updateSong]);

  // Every station with its record and the current song's campaign state
  const rows = useMemo(() => {
    const now = Date.now();
    return stations.map(s => {
      const rec = crm[s.id] || blankStation();
      const per = Object.fromEntries(songs.map(sg => [sg.id, songInfo(rec.songs[sg.id], now)]));
      return { ...s, rec, per, cur: per[song.id] };
    });
  }, [crm, songs, song.id]);
  const due = useMemo(() => rows.filter(s => s.cur.isDue && !s.rec.dnc), [rows]);

  const openMailer = (ids, kind = "pitch", songFor) => {
    const list = ids.filter(id => byId[id]);
    if (list.length) setMailer({ ids: list, kind, song: songFor || song.id });
  };
  const approve = items => {
    setQueue(q => {
      const m = new Map(q.map(x => [`${x.id}:${x.song}:${x.kind}`, x]));
      items.forEach(x => m.set(`${x.id}:${x.song}:${x.kind}`, { ...x, approvedAt: new Date().toISOString() }));
      return [...m.values()];
    });
    items.forEach(x => logEvent(x.id, x.song, "queued", `${x.kind === "followup" ? "Follow-up" : "Pitch"} added to the send list`));
    setSelected([]);
  };
  const saveSong = s => {
    setSongs(list => (list.some(x => x.id === s.id) ? list.map(x => (x.id === s.id ? s : x)) : [s, ...list]));
    setSongId(s.id);
    setSongForm(null);
  };

  const ctx = { stations: rows, byId, songs, song, setSongId, crm, updateStation, updateSong, setStatus, logEvent, selected, setSelected, openSheet: setSheet, openMailer, queue, due, setView, openSongForm: setSongForm };
  const badges = { stations: stations.length, followups: due.length || null, sendlist: queue.length || null };

  return (
    <MotionConfig reducedMotion="user">
      <a className="skip" href="#main">Skip to content</a>
      <header className="masthead">
        <button className="brand" onClick={() => setView("booth")} aria-label="FloodLines Radio, go to the booth">
          <span className="brand-name">FloodLines</span>
          <span className="brand-sub">Radio booth</span>
        </button>
        <LayoutGroup id="nav">
          <nav className="nav" aria-label="Main">
            {nav.map(([k, label, Icon]) => (
              <button key={k} className={`nav-btn${view === k ? " on" : ""}`} aria-current={view === k ? "page" : undefined} onClick={() => setView(k)}>
                {view === k && <motion.span layoutId="nav-led" className="nav-led" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
                {badges[k] != null && <span className={`nav-badge${k === "followups" ? " hot" : ""}`}>{badges[k]}</span>}
              </button>
            ))}
          </nav>
        </LayoutGroup>
        <OnAir count={queue.length} onClick={() => setView("sendlist")} />
      </header>

      <NowPitching {...ctx} />

      <main id="main" className="stage">
        <AnimatePresence mode="wait">
          <motion.div key={view} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22, ease: [0.2, 0.8, 0.3, 1] }}>
            {view === "booth" && <Booth {...ctx} />}
            {view === "stations" && <StationsTable {...ctx} />}
            {view === "pipeline" && <Pipeline {...ctx} />}
            {view === "followups" && <Followups {...ctx} />}
            {view === "sendlist" && <SendList {...ctx} items={queue} setItems={setQueue} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <StationSheet id={sheet} {...ctx} onClose={() => setSheet(null)} />
      <Mailer job={mailer} {...ctx} onApprove={approve} onClose={() => setMailer(null)} />
      <SongForm value={songForm} songs={songs} onSave={saveSong} onClose={() => setSongForm(null)} />
    </MotionConfig>
  );
}
