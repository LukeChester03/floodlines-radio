import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { band, fill, placeholders, templates as baseTemplates } from "../songs.js";
import { useLocal } from "../store.js";
import { DAILY_SEND_CAP, statusLabel } from "../crm.js";
import { Modal, Sleeve } from "../ui/bits.jsx";

// The promo mailer: one template, one personal email per station, tagged with the song being pitched
export default function Mailer({ job, stations, songs, song: currentSong, queue, onApprove, onClose }) {
  const kind = job?.kind || "pitch";
  const [songId, setSongId] = useState(currentSong.id);
  const song = songs.find(s => s.id === songId) || currentSong;
  const [tpls, setTpls] = useLocal("fl2-templates", baseTemplates);
  const [signoff, setSignoff] = useLocal("fl-signoff", band.signoff);
  const [others, setOthers] = useLocal("fl2-include-others", true);
  const [edits, setEdits] = useState({});
  const [include, setInclude] = useState({});
  const [cursor, setCursor] = useState(0);

  const list = useMemo(() => (job ? job.ids.map(id => stations.find(s => s.id === id)).filter(Boolean) : []), [job, stations]);
  const fresh = (s, sid) => s.email && !s.rec.dnc && !(kind === "pitch" && s.per[sid].status !== "new");
  useEffect(() => {
    if (!job) return;
    setSongId(job.song || currentSong.id);
    setEdits({});
    setCursor(0);
    setInclude(Object.fromEntries(list.map(s => [s.id, fresh(s, job.song || currentSong.id)])));
  }, [job]); // eslint-disable-line react-hooks/exhaustive-deps

  const tpl = tpls[kind] || baseTemplates[kind];
  const draftFor = s => edits[s.id] || fill(tpl, s, song, songs, { signoff, includeOthers: kind === "pitch" && others });
  const current = list[cursor];
  const draft = current ? draftFor(current) : null;
  const chosen = list.filter(s => include[s.id]);
  const queued = new Set(queue.map(q => `${q.id}:${q.song}:${q.kind}`));

  const warn = s =>
    !s.email ? "No email address"
    : s.rec.dnc ? "Marked do not contact"
    : kind === "pitch" && s.per[song.id].status !== "new" ? `Already ${statusLabel[s.per[song.id].status].toLowerCase()} for ${song.title}`
    : queued.has(`${s.id}:${song.id}:${kind}`) ? "Already in the send list, will be replaced"
    : s.restricted ? "Says local acts only"
    : null;

  const pickSong = id => {
    setSongId(id);
    setEdits({});
    setInclude(Object.fromEntries(list.map(s => [s.id, fresh(s, id)])));
  };
  const approve = () => {
    onApprove(chosen.map(s => {
      const d = draftFor(s);
      return { id: s.id, song: song.id, kind, station: s.name, show: s.show, to: s.email, subject: d.subject, body: d.body };
    }));
    onClose();
  };
  const setTpl = patch => { setTpls(t => ({ ...t, [kind]: { ...tpl, ...patch } })); setEdits({}); };

  return (
    <Modal open={!!(job && current)} onClose={onClose} label="Blanket email" className="mailer">
      {current && (
        <>
          <header className="ml-head" style={{ "--song": song.color }}>
            <span className="promo-stamp small" aria-hidden="true">Promo copy</span>
            <h2 className="dlg-title">{kind === "followup" ? "Follow-ups" : "Blanket email"}: {song.title}</h2>
            <p className="dlg-sub">{chosen.length} of {list.length} stations get their own personal email from {band.email}. Untick anyone you'd rather leave out.</p>
            <div className="ml-songs" role="group" aria-label="Song to pitch">
              {songs.map(s => (
                <button key={s.id} className={`song-chip${s.id === song.id ? " on" : ""}`} aria-pressed={s.id === song.id} style={{ "--song": s.color }} onClick={() => pickSong(s.id)}>
                  <Sleeve song={s} size={24} /><span>{s.title}</span>
                </button>
              ))}
            </div>
          </header>

          <div className="ml-body">
            <aside className="ml-recips" aria-label="Recipients">
              <ul>
                {list.map((s, i) => {
                  const w = warn(s);
                  return (
                    <li key={s.id} className={`${i === cursor ? "on" : ""}${include[s.id] ? "" : " off"}`}>
                      <input type="checkbox" checked={!!include[s.id]} disabled={!s.email} onChange={e => setInclude(x => ({ ...x, [s.id]: e.target.checked }))} aria-label={`Include ${s.name}`} />
                      <button onClick={() => setCursor(i)} aria-current={i === cursor ? "true" : undefined}>
                        <b>{s.name}</b>
                        <span>{s.email || "no email"}</span>
                        {w && <em>{w}</em>}
                        {edits[s.id] && <em className="edited">Edited</em>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </aside>

            <div className="ml-editor">
              <div className="ml-controls">
                <label className="inline"><span>Signed</span><input value={signoff} onChange={e => { setSignoff(e.target.value); setEdits({}); }} /></label>
                {kind === "pitch" && songs.length > 1 && (
                  <label className="check"><input type="checkbox" checked={others} onChange={e => { setOthers(e.target.checked); setEdits({}); }} /> Mention your other songs too</label>
                )}
              </div>
              <AnimatePresence mode="wait">
                <motion.div key={current.id + song.id} className="letter" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.16 }}>
                  <dl className="envelope">
                    <div><dt>From</dt><dd>{band.email}</dd></div>
                    <div><dt>To</dt><dd>{current.email || "No email address"}{current.contactName ? ` (${current.contactName})` : ""}</dd></div>
                    <div><dt>Song</dt><dd>{song.title}</dd></div>
                  </dl>
                  {current.instructions && <p className="their-rules"><b>They ask for:</b> {current.instructions}</p>}
                  <label className="field"><span>Subject</span>
                    <input value={draft.subject} onChange={e => setEdits(x => ({ ...x, [current.id]: { ...draft, subject: e.target.value } }))} />
                  </label>
                  <label className="field"><span>Email to {current.name}</span>
                    <textarea rows={14} value={draft.body} onChange={e => setEdits(x => ({ ...x, [current.id]: { ...draft, body: e.target.value } }))} />
                  </label>
                  <div className="pager">
                    <button className="icon-btn" disabled={cursor === 0} onClick={() => setCursor(cursor - 1)} aria-label="Previous station"><ChevronLeft size={18} /></button>
                    <span>{cursor + 1} of {list.length}</span>
                    <button className="icon-btn" disabled={cursor === list.length - 1} onClick={() => setCursor(cursor + 1)} aria-label="Next station"><ChevronRight size={18} /></button>
                  </div>
                </motion.div>
              </AnimatePresence>

              <details className="ml-template">
                <summary>Edit the template used for every {kind === "followup" ? "follow-up" : "pitch"}</summary>
                <p className="hint">Placeholders: {placeholders.join(" ")}. {"{name}"} uses the contact's first name where the station publishes one, otherwise "[station] team". Changing the template resets per-station edits.</p>
                <label className="field"><span>Subject</span><input value={tpl.subject} onChange={e => setTpl({ subject: e.target.value })} /></label>
                <label className="field"><span>Body</span><textarea rows={10} value={tpl.body} onChange={e => setTpl({ body: e.target.value })} /></label>
                <button className="link-btn" onClick={() => { setTpls(t => ({ ...t, [kind]: baseTemplates[kind] })); setEdits({}); }}>Reset to the original template</button>
              </details>
            </div>
          </div>

          <footer className="ml-foot">
            <button className="btn btn-primary" disabled={!chosen.length} onClick={approve}>Add {chosen.length} {song.title} {kind === "followup" ? "follow-ups" : "pitches"} to the send list</button>
            <p className="hint">{chosen.length > DAILY_SEND_CAP ? `More than ${DAILY_SEND_CAP}, so the send list splits it into daily batches. ` : ""}Nothing sends until you give the list to Claude and confirm.</p>
          </footer>
        </>
      )}
    </Modal>
  );
}
