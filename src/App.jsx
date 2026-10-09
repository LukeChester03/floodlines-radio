import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from "motion/react";
import { CalendarClock, KanbanSquare, LayoutDashboard, LogOut, Mail, Table2 } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "./firebase.js";
import { importLocal, localData, useCloud } from "./cloud.js";
import stations from "./data/stations.json";
import sentLog from "./data/sent-log.json";
import pastPlays from "./data/history.json";
import { useLocal } from "./store.js";
import { defaultSongs } from "./songs.js";
import { blankSong, blankStation, knownSends, sentKey, songInfo, statusLabel, withSentLog } from "./crm.js";
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
const views = nav.map(n => n[0]);
const fromHash = () => (views.includes(location.hash.slice(1)) ? location.hash.slice(1) : null);

export default function App({ user }) {
  const [view, setViewState] = useState(() => fromHash() || "booth");
  const setView = useCallback(v => {
    if (v !== fromHash()) window.history.pushState(null, "", `#${v}`);
    setViewState(v);
    window.scrollTo({ top: 0 });
  }, []);
  useEffect(() => {
    const onPop = () => setViewState(fromHash() || "booth");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const cloud = useCloud(user);
  const songs = cloud.songs;
  const [songId, setSongId] = useLocal("fl2-song", "companion");
  const [selected, setSelected] = useState([]);
  const [sheet, setSheet] = useState(null);
  const [mailer, setMailer] = useState(null); // { ids, kind, song, prefill }
  const [songForm, setSongForm] = useState(null); // null | "new" | song
  const [local, setLocal] = useState(() => localData());

  const song = songs.find(s => s.id === songId) || songs[0] || defaultSongs[0];
  const sends = useMemo(() => knownSends(sentLog, cloud.sends), [cloud.sends]);
  const knownLog = useMemo(() => [...pastPlays, ...sends], [sends]);
  const crm = useMemo(() => withSentLog(cloud.crm, knownLog), [cloud.crm, knownLog]);
  const sentKeys = useMemo(() => new Set(sends.map(sentKey)), [sends]);

  // Anything Claude has already sent drops out of the send list, so it can't be sent twice
  const queue = useMemo(() => cloud.queue.filter(q => !sentKeys.has(sentKey(q))), [cloud.queue, sentKeys]);
  const sentStillQueued = useMemo(() => cloud.queue.filter(q => sentKeys.has(sentKey(q))).map(sentKey), [cloud.queue, sentKeys]);
  const { removeFromQueue } = cloud;
  useEffect(() => { if (sentStillQueued.length) removeFromQueue(sentStillQueued); }, [sentStillQueued, removeFromQueue]);
  const queuedKeys = useMemo(() => new Set(queue.map(sentKey)), [queue]);

  // Edits start from the record as shown (including what the send log knows), then save to the database
  const { updateStation: saveStation } = cloud;
  const updateStation = useCallback((id, patch) => saveStation(id, cur => {
    const merged = withSentLog({ [id]: cur }, knownLog)[id] || blankStation();
    return typeof patch === "function" ? patch(merged) : patch;
  }), [saveStation, knownLog]);
  const updateSong = useCallback((id, sid, patch) => updateStation(id, st => {
    const cur = st.songs[sid] || blankSong();
    return { songs: { ...st.songs, [sid]: { ...cur, ...(typeof patch === "function" ? patch(cur) : patch) } } };
  }), [updateStation]);
  // Marking a song as pitched or followed up by hand (e.g. sent through a form) starts the follow-up clock too
  const setStatus = useCallback((ids, status, sid = song.id) => ids.forEach(id => updateSong(id, sid, r => {
    const at = new Date().toISOString();
    const entries = [{ at, type: "status", text: `Moved to ${statusLabel[status] || status}` }];
    if (status === "pitched" && r.status === "new") entries.push({ at, type: "pitch", text: "Marked as pitched (sent outside the site)" });
    if (status === "followed" && r.status === "pitched") entries.push({ at, type: "followup", text: "Marked as followed up (sent outside the site)" });
    return { status, log: [...r.log, ...entries] };
  })), [updateSong, song.id]);
  const logEvent = useCallback((id, sid, type, text) => updateSong(id, sid, r => ({ log: [...r.log, { at: new Date().toISOString(), type, text }] })), [updateSong]);

  // Every station with its record, every song's state, and the current song's state
  const rows = useMemo(() => {
    const now = Date.now();
    return stations.map(s => {
      const rec = crm[s.id] || blankStation();
      const per = Object.fromEntries(songs.map(sg => [sg.id, { ...songInfo(rec.songs[sg.id], now), queued: queuedKeys.has(`${s.id}:${sg.id}:pitch`) }]));
      return { ...s, rec, per, cur: per[song.id] };
    });
  }, [crm, songs, song.id, queuedKeys]);
  // Follow-ups due for every song, not just the one on screen
  const dueAll = useMemo(() => rows.flatMap(s => (s.rec.dnc ? [] : songs.filter(sg => s.per[sg.id].isDue).map(sg => ({ ...s, dueSong: sg })))), [rows, songs]);

  const openMailer = (ids, kind = "pitch", songFor, prefill) => {
    const list = ids.filter(id => byId[id]);
    if (list.length) setMailer({ ids: list, kind, song: songFor || song.id, prefill });
  };
  const approve = items => {
    cloud.addToQueue(items);
    items.forEach(x => logEvent(x.id, x.song, "queued", `${x.kind === "followup" ? "Follow-up" : "Pitch"} added to the send list`));
    setSelected([]);
  };
  const saveSong = s => {
    cloud.saveSong(s);
    setSongId(s.id);
    setSongForm(null);
  };
  const deleteSong = id => {
    cloud.deleteSong(id);
    if (songId === id) setSongId(songs.find(x => x.id !== id)?.id);
    setSongForm(null);
  };
  const runImport = async () => {
    try { await importLocal(user, local); setLocal(null); } catch (e) { alert(`Couldn't import (${e.code || e.message}). Nothing was lost; try again.`); }
  };

  if (cloud.error) return <main className="gate"><div className="gate-card"><h1 className="gate-title">Something's off</h1><p className="gate-sub">{cloud.error}</p><button className="btn" onClick={() => signOut(auth)}>Sign out</button></div></main>;
  if (!cloud.ready) return <main className="gate" aria-busy="true"><p className="gate-loading">Loading the band's campaign…</p></main>;

  const ctx = { stations: rows, byId, songs, song, setSongId, crm, updateStation, updateSong, setStatus, logEvent, selected, setSelected, openSheet: setSheet, openMailer, approve, queue, dueAll, setView, openSongForm: setSongForm, cloud, user };
  const badges = { stations: stations.length, followups: dueAll.length || null, sendlist: queue.length || null };

  return (
    <MotionConfig reducedMotion="user">
      <div className="app-shell">
        <a className="skip" href="#main">Skip to content</a>
        <header className="masthead">
          <button className="brand" onClick={() => setView("booth")} aria-label="FloodLines radio booth, go to the overview">
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
                  {badges[k] != null && <span className={`nav-badge${k === "followups" || k === "sendlist" ? " hot" : ""}`}>{badges[k]}</span>}
                </button>
              ))}
            </nav>
          </LayoutGroup>
          <OnAir count={queue.length} onClick={() => setView("sendlist")} />
          <button className="icon-btn signout" onClick={() => signOut(auth)} aria-label={`Sign out ${user.email}`} title={`Signed in as ${user.email}`}><LogOut size={16} aria-hidden="true" /></button>
        </header>
        {local && (
          <div className="import-bar" role="region" aria-label="Import data from this browser">
            <span>This browser has campaign data from before the shared database. Move it in so the whole band can see it?</span>
            <button className="btn btn-primary" onClick={runImport}>Import it</button>
            <button className="link-btn" onClick={() => setLocal(null)}>Not now</button>
          </div>
        )}

        <NowPitching {...ctx} />

        <main id="main" className="stage" tabIndex={-1}>
          <AnimatePresence mode="wait">
            <motion.div key={view} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22, ease: [0.2, 0.8, 0.3, 1] }}>
              {view === "booth" && <Booth {...ctx} />}
              {view === "stations" && <StationsTable {...ctx} />}
              {view === "pipeline" && <Pipeline {...ctx} />}
              {view === "followups" && <Followups {...ctx} />}
              {view === "sendlist" && <SendList {...ctx} items={queue} />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <StationSheet id={sheet} {...ctx} onClose={() => setSheet(null)} />
      <Mailer job={mailer} {...ctx} onApprove={approve} onClose={() => setMailer(null)} />
      <SongForm value={songForm} songs={songs} onSave={saveSong} onDelete={deleteSong} onClose={() => setSongForm(null)} />
    </MotionConfig>
  );
}
