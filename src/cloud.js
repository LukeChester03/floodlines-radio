// Shared campaign data in Firestore, synced live between the band's devices.
//   stations/{stationId}  status per song, notes, tags, star, do-not-contact
//   songs/{songId}        the singles being pitched
//   sendlist/{key}        approved emails the band reviews, approves and the scheduled run sends
//   sends/{id}            one record per email the server sent (written by the server only)
//   settings/shared       email templates, sign-off, "mention other songs"
import { useCallback, useEffect, useRef, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, setDoc, writeBatch } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "./firebase.js";
import { defaultSongs, templates as baseTemplates, band } from "./songs.js";
import config from "./firebase-config.json";
import { entryStateWrites } from "../functions/core/entryState.js";
import { blankStation, migrate, sentKey } from "./crm.js";

export const connectGmailUrl = `https://europe-west2-${config.projectId}.cloudfunctions.net/connectGmail`;
const defaultSettings = { templates: baseTemplates, signoff: band.signoff, includeOthers: true };
const stamp = user => ({ updatedAt: new Date().toISOString(), updatedBy: user?.email || null });
const strip = ({ updatedAt, updatedBy, ...rest }) => rest; // eslint-disable-line no-unused-vars

export function useCloud(user) {
  const [crm, setCrm] = useState({});
  const [songs, setSongs] = useState(null);
  const [queue, setQueue] = useState([]);
  const [sends, setSends] = useState([]);
  const [settings, setSettings] = useState(defaultSettings);
  const [loaded, setLoaded] = useState({ stations: false, songs: false, sendlist: false, sends: false, settings: false });
  const [gmail, setGmail] = useState(undefined);
  const [error, setError] = useState(null);
  const crmRef = useRef({});
  crmRef.current = crm;

  useEffect(() => {
    if (!user) return;
    const fail = e => setError(e.code === "permission-denied" ? "This account doesn't have access to the band's data." : `Couldn't reach the database (${e.code || e.message}).`);
    const done = k => setLoaded(l => (l[k] ? l : { ...l, [k]: true }));
    const unsubs = [
      onSnapshot(collection(db, "stations"), snap => {
        const next = {};
        snap.forEach(d => { next[d.id] = strip(d.data()); });
        setCrm(next);
        done("stations");
      }, fail),
      onSnapshot(collection(db, "songs"), snap => {
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...strip(d.data()) }));
        // Newest release first; songs without a date (unreleased) at the top
        list.sort((a, b) => (b.released || "9999").localeCompare(a.released || "9999") || a.title.localeCompare(b.title));
        setSongs(list);
        done("songs");
      }, fail),
      onSnapshot(collection(db, "sendlist"), snap => {
        const list = [];
        snap.forEach(d => list.push(strip(d.data())));
        list.sort((a, b) => (a.addedAt || a.approvedAt || "").localeCompare(b.addedAt || b.approvedAt || ""));
        setQueue(list);
        done("sendlist");
      }, fail),
      onSnapshot(collection(db, "sends"), snap => {
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        setSends(list);
        done("sends");
      }, fail),
      onSnapshot(doc(db, "settings", "shared"), snap => {
        setSettings({ ...defaultSettings, ...(snap.exists() ? strip(snap.data()) : {}) });
        done("settings");
      }, fail),
    ];
    // Not part of "loaded": a missing status just means Gmail isn't connected yet
    unsubs.push(onSnapshot(doc(db, "gmail", "status"), snap => setGmail(snap.exists() ? snap.data() : {}), () => setGmail({})));
    return () => unsubs.forEach(u => u());
  }, [user]);

  // The first time the band signs in, put Companion and Final Fear in the database
  useEffect(() => {
    if (!user || !loaded.songs || songs?.length) return;
    const batch = writeBatch(db);
    defaultSongs.forEach(s => batch.set(doc(db, "songs", s.id), { ...s, ...stamp(user) }));
    batch.commit().catch(e => setError(`Couldn't save the default songs (${e.code}).`));
  }, [user, loaded.songs, songs]);

  const updateStation = useCallback((id, patch) => {
    const cur = crmRef.current[id] || blankStation();
    const next = { ...cur, ...(typeof patch === "function" ? patch(cur) : patch) };
    crmRef.current = { ...crmRef.current, [id]: next };
    setCrm(c => ({ ...c, [id]: next }));
    return setDoc(doc(db, "stations", id), { ...next, ...stamp(user) }).catch(e => setError(`Couldn't save that change (${e.code}).`));
  }, [user]);

  const saveSong = useCallback(s => setDoc(doc(db, "songs", s.id), { ...s, ...stamp(user) }), [user]);
  const deleteSong = useCallback(id => deleteDoc(doc(db, "songs", id)), []);

  const addToQueue = useCallback(items => {
    const batch = writeBatch(db);
    items.forEach(x => batch.set(doc(db, "sendlist", sentKey(x)), { ...x, state: "review", addedAt: new Date().toISOString(), ...stamp(user) }));
    return batch.commit();
  }, [user]);
  const removeFromQueue = useCallback(keys => {
    const batch = writeBatch(db);
    keys.forEach(k => batch.delete(doc(db, "sendlist", k)));
    return batch.commit();
  }, []);

  // Retry (failed -> approved) and Pause (approved -> review): only the entry's state is written
  const setEntryState = useCallback((keys, state) => {
    const batch = writeBatch(db);
    entryStateWrites(keys, state, user).forEach(w => batch.update(doc(db, ...w.path.split("/")), w.data));
    return batch.commit();
  }, [user]);

  const approveAll =useCallback(keys => httpsCallable(functions, "sendPitch")({ keys }).then(r => r.data), []);

  const saveSettings = useCallback(patch => {
    setSettings(s => ({ ...s, ...patch }));
    return setDoc(doc(db, "settings", "shared"), { ...patch, ...stamp(user) }, { merge: true });
  }, [user]);

  const ready = Object.values(loaded).every(Boolean) && songs?.length > 0;
  return { ready, error, gmail, crm, songs: songs || [], queue, sends, settings, updateStation, saveSong, deleteSong, addToQueue, removeFromQueue, setEntryState, approveAll, saveSettings };
}

// One-off move of data saved in this browser (before the database existed) into Firestore
export function localData() {
  try {
    const crm = migrate(JSON.parse(localStorage.getItem("fl-crm") || "{}"));
    const songs = JSON.parse(localStorage.getItem("fl2-songs") || "null");
    const queue = JSON.parse(localStorage.getItem("fl2-sendlist") || "[]");
    const templates = JSON.parse(localStorage.getItem("fl2-templates") || "null");
    const touched = Object.keys(crm).length || queue.length || (songs && songs.length > defaultSongs.length);
    return touched ? { crm, songs, queue, templates } : null;
  } catch {
    return null;
  }
}

export async function importLocal(user, data) {
  const ops = [
    ...Object.entries(data.crm).map(([id, rec]) => ["stations", id, rec]),
    ...(data.songs || []).map(s => ["songs", s.id, s]),
    ...data.queue.map(q => ["sendlist", sentKey(q), q]),
  ];
  // Firestore batches hold up to 500 writes
  for (let i = 0; i < ops.length; i += 450) {
    const batch = writeBatch(db);
    ops.slice(i, i + 450).forEach(([c, id, v]) => batch.set(doc(db, c, id), { ...v, ...stamp(user) }));
    await batch.commit();
  }
  if (data.templates) await setDoc(doc(db, "settings", "shared"), { templates: data.templates, ...stamp(user) }, { merge: true });
  ["fl-crm", "fl2-songs", "fl2-sendlist", "fl2-templates"].forEach(k => localStorage.removeItem(k));
}

// Full export of the shared data, for keeping a copy
export function exportAll({ crm, songs, queue, settings }) {
  return { app: "floodlines-radio", savedAt: new Date().toISOString(), stations: crm, songs, sendlist: queue, settings };
}
