import { useEffect, useState } from "react";
import { ExternalLink, Mail, Star } from "lucide-react";
import { fmtDate, statuses } from "../crm.js";
import { Meter, Modal, StatusTag, flag, genreLabel, routeLabel, tierLabel, typeLabel } from "../ui/bits.jsx";

// One station: their rules, where it ranks, its status for every song, notes and history
export default function StationSheet({ id, stations, songs, song, updateStation, setStatus, openMailer, onClose }) {
  const s = id ? stations.find(x => x.id === id) : null;
  const [notes, setNotes] = useState("");
  const [tag, setTag] = useState("");
  useEffect(() => { setNotes(s?.rec.notes || ""); setTag(""); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const history = s ? songs.flatMap(sg => (s.rec.songs[sg.id]?.log || []).map(l => ({ ...l, song: sg }))).sort((a, b) => b.at.localeCompare(a.at)) : [];

  return (
    <Modal open={!!s} onClose={onClose} label={s?.name || "Station"} side>
      {s && (
        <div className="sheet-body">
          <p className="sheet-where">{flag(s.country)} {s.region || s.country} · {typeLabel[s.type] || s.type}</p>
          <h2 className="sheet-title">{s.name}</h2>
          {s.show && <p className="sheet-show">{s.show}</p>}

          <dl className="facts">
            <div><dt>Apply by</dt><dd>{routeLabel[s.route]}</dd></div>
            <div><dt>Genre</dt><dd>{genreLabel[s.genreFit]}{s.genres && <small>{s.genres}</small>}</dd></div>
            <div><dt>Priority</dt><dd>{s.tier ? `${tierLabel[s.tier]} · ${s.score}/100` : "Not ranked"}</dd></div>
            <div><dt>Chance of a play</dt><dd><Meter value={s.chance} label="Chance" /></dd></div>
            <div><dt>Value of a play</dt><dd><Meter value={s.value} label="Value" /></dd></div>
            <div><dt>Contact</dt><dd>{s.contactName || "Not published"}{s.email && <small>{s.email}</small>}</dd></div>
          </dl>

          {s.restricted && <p className="warn">This station says it only takes local acts. You can still try, but expect a no unless you have a local link.</p>}
          {s.reasons.length > 0 && <ul className="reasons">{s.reasons.map(r => <li key={r}>{r}</li>)}</ul>}
          {s.pitchTip && <p className="tip"><b>Tip:</b> {s.pitchTip}</p>}

          <section className="sheet-sec">
            <h3>What they ask for</h3>
            <p>{s.instructions || "No instructions published."}</p>
            {s.notes && <p className="muted">{s.notes}</p>}
            <a href={s.sourceUrl} target="_blank" rel="noopener" className="ext">Their submission page <ExternalLink size={14} aria-hidden="true" /></a>
          </section>

          <div className="sheet-actions">
            {s.route === "email" && !s.rec.dnc && (
              <button className="btn btn-primary" onClick={() => { onClose(); openMailer([s.id], s.cur.status === "new" ? "pitch" : "followup"); }}>
                <Mail size={16} aria-hidden="true" /> {s.cur.status === "new" ? `Pitch ${song.title}` : `Follow up on ${song.title}`}
              </button>
            )}
            {s.route !== "email" && (s.formUrl || s.sourceUrl) && (
              <a className="btn btn-primary" href={s.formUrl || s.sourceUrl} target="_blank" rel="noopener">
                {s.route === "platform" ? "Open the uploader" : s.route === "post" ? "See postal details" : "Open their form"} <ExternalLink size={14} aria-hidden="true" />
              </a>
            )}
            {s.route !== "email" && s.cur.status === "new" && <button className="btn" onClick={() => setStatus([s.id], "pitched")}>I've sent {song.title} via their form</button>}
            <button className={`btn${s.rec.starred ? " btn-on" : ""}`} aria-pressed={s.rec.starred} onClick={() => updateStation(s.id, r => ({ starred: !r.starred }))}>
              <Star size={16} fill={s.rec.starred ? "currentColor" : "none"} aria-hidden="true" /> {s.rec.starred ? "Starred" : "Star"}
            </button>
          </div>

          <section className="sheet-sec">
            <h3>Status by song</h3>
            <ul className="per-song">
              {songs.map(sg => (
                <li key={sg.id} style={{ "--song": sg.color }}>
                  <span className="ps-title">{sg.title}</span>
                  <label className="ps-select">
                    <span className="sr-only">{sg.title} status</span>
                    <select value={s.per[sg.id].status} onChange={e => setStatus([s.id], e.target.value, sg.id)}>
                      {statuses.map(st => <option key={st.key} value={st.key}>{st.label}</option>)}
                    </select>
                  </label>
                  <span className="muted">{s.per[sg.id].lastAt ? `Last ${fmtDate(s.per[sg.id].lastAt)}` : ""}{s.per[sg.id].isDue ? " · follow-up due" : ""}</span>
                </li>
              ))}
            </ul>
            <label className="check dnc-check">
              <input type="checkbox" checked={s.rec.dnc} onChange={e => updateStation(s.id, { dnc: e.target.checked })} />
              Do not contact this station again (it's left out of every blanket email)
            </label>
          </section>

          <section className="sheet-sec">
            <h3>Tags</h3>
            <div className="tags">
              {s.rec.tags.map(t => (
                <button key={t} className="tag" onClick={() => updateStation(s.id, r => ({ tags: r.tags.filter(x => x !== t) }))} aria-label={`Remove tag ${t}`}>{t} ×</button>
              ))}
              <form onSubmit={e => { e.preventDefault(); const t = tag.trim(); if (t) updateStation(s.id, r => ({ tags: [...new Set([...r.tags, t])] })); setTag(""); }}>
                <input value={tag} onChange={e => setTag(e.target.value)} placeholder="Add a tag, press Enter" aria-label="Add a tag" />
              </form>
            </div>
          </section>

          <section className="sheet-sec">
            <h3><label htmlFor="notes">Notes</label></h3>
            <textarea id="notes" rows={4} value={notes} onChange={e => setNotes(e.target.value)} onBlur={() => notes !== s.rec.notes && updateStation(s.id, { notes })} placeholder="Who you spoke to, what they said, which show played you…" />
          </section>

          <section className="sheet-sec">
            <h3>History</h3>
            {history.length === 0 ? <p className="muted">No contact yet.</p> : (
              <ol className="timeline">
                {history.map((l, i) => (
                  <li key={i} style={{ "--song": l.song.color }}>
                    <time>{fmtDate(new Date(l.at))}</time> <span className="tl-song">{l.song.title}</span> {l.text}
                  </li>
                ))}
              </ol>
            )}
          </section>
          <p className="muted small">Current {song.title} status: <StatusTag status={s.cur.status} small /></p>
        </div>
      )}
    </Modal>
  );
}
