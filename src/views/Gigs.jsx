import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { gigDecisions, gigSettings, gigView, parseList, runSummary } from "../gigs.js";
import { fmtDate } from "../crm.js";
import { Plus, Settings2 } from "lucide-react";
import { Empty, Modal } from "../ui/bits.jsx";

const host = u => { try { return new URL(u).host; } catch { return u; } };
// A gig is still being read until it has been scored
const reading = g => g.score == null;

const label = d => d[0].toUpperCase() + d.slice(1);
const filters = ["new", ...gigDecisions, "all"];
const monthName = m => new Date(`${m}-01T00:00:00Z`).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

function Card({ g, decide }) {
  if (reading(g)) {
    return (
      <motion.li layout className="gig-card gig-skeleton" aria-busy="true" initial={{ opacity: 0 }} animate={{ opacity: [0.5, 1, 0.5] }} exit={{ opacity: 0 }} transition={{ duration: 1.4, repeat: Infinity }}>
        <span className="sr-only">Reading this gig…</span>
        <span className="gig-bar" /><span className="gig-bar short" />
      </motion.li>
    );
  }
  const place = [g.town, g.county].filter(Boolean).join(", ");
  return (
    <motion.li layout className="gig-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.2 }}>
      <div className="gig-top">
        <b>{g.date ? fmtDate(new Date(g.date)) : "Date to confirm"}</b>
        <span className="sent-chip">{g.venue || g.title}</span>
        {place && <span className="muted">{place}</span>}
        {g.genre && <span className="tag">{g.genre}</span>}
        <span className="gig-score" title="Score">{g.score}</span>
      </div>
      {g.bands?.length > 0 && (
        <p className="gig-line"><span className="muted">On the bill: </span>
          {g.bands.map((b, i) => (
            <span key={b.name + i}>{i > 0 && ", "}{b.link ? <a className="link-btn" href={b.link} target="_blank" rel="noreferrer">{b.name}<span className="sr-only"> (new tab)</span></a> : b.name}</span>
          ))}
        </p>
      )}
      {g.howToApply && <p className="gig-line"><span className="muted">How to apply: </span>{g.howToApply}</p>}
      {g.reasons?.length > 0 && <ul className="gig-reasons">{g.reasons.map(r => <li key={r}>{r}</li>)}</ul>}
      <div className="gig-decide" role="group" aria-label={`Your decision on ${g.venue || g.title}`}>
        {gigDecisions.map(d => (
          <motion.button key={d} type="button" className={`view-chip${g.decision === d ? " on" : ""}`} aria-pressed={g.decision === d} onClick={() => decide(g.id, d)} whileTap={{ scale: 0.94 }} animate={{ scale: g.decision === d ? [1, 1.12, 1] : 1 }} transition={{ duration: 0.25 }}>{label(d)}</motion.button>
        ))}
      </div>
      <p className="gig-line"><a className="link-btn" href={g.url} target="_blank" rel="noreferrer">Original post · {host(g.url)}<span className="sr-only"> (new tab)</span></a></p>
    </motion.li>
  );
}

function AddGig({ add }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const opener = useRef(null);
  const close = () => { setOpen(false); setError(""); setTimeout(() => opener.current?.focus(), 0); };
  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await add(url.trim(), text);
      setUrl(""); setText("");
      close();
    } catch (err) {
      setError(err.message || "Couldn't add that gig");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="gig-add">
      <button ref={opener} type="button" className="btn" aria-expanded={open} onClick={() => setOpen(o => !o)}><Plus size={14} aria-hidden="true" /> Add a gig</button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.form key="form" className="gig-add-form" onSubmit={submit} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
            <p className="hint">Instagram and TikTok can't be searched, so paste the post here.</p>
            <label className="field"><span>Link to the post</span><input type="url" inputMode="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.instagram.com/p/…" required /></label>
            <label className="field"><span>The post's text</span><textarea rows={5} value={text} onChange={e => setText(e.target.value)} required /></label>
            {error && <p className="form-err" role="alert">{error}</p>}
            <div className="dlg-actions">
              <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Reading the post…" : "Add gig"}</button>
              <button type="button" className="btn" onClick={close}>Cancel</button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

const fields = [
  ["gigAreas", "areas", "Areas", "Towns and counties to look in."],
  ["similarArtists", "similarArtists", "Similar artists", "Gigs with these on the bill score higher."],
  ["gigPhrases", "phrases", "Search phrases", "What a slot post tends to say, e.g. support slot."],
];

function SearchSettings({ settings, save }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const opener = useRef(null);
  const toggle = () => {
    if (!open) {
      const cur = gigSettings(settings);
      setDraft(Object.fromEntries(fields.map(([key, k]) => [key, cur[k].join("\n")])));
      setSaved(false); setError("");
    }
    setOpen(o => !o);
  };
  const write = async patch => {
    setBusy(true); setError(""); setSaved(false);
    try { await save(patch); return true; } catch (err) { setError(err.message || "Couldn't save the settings"); return false; } finally { setBusy(false); }
  };
  const submit = async e => {
    e.preventDefault();
    if (await write(Object.fromEntries(fields.map(([key]) => [key, parseList(draft[key])])))) setSaved(true);
  };
  const reset = async () => {
    if (await write({ gigAreas: [], similarArtists: [], gigPhrases: [] })) {
      const cur = gigSettings({});
      setDraft(Object.fromEntries(fields.map(([key, k]) => [key, cur[k].join("\n")])));
      setConfirming(false); setSaved(true);
      setTimeout(() => opener.current?.focus(), 0);
    }
  };
  return (
    <div className="gig-add">
      <button ref={opener} type="button" className="btn" aria-expanded={open} onClick={toggle}><Settings2 size={14} aria-hidden="true" /> Search settings</button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.form key="form" className="gig-add-form" onSubmit={submit} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
            <p className="hint">One per line. The weekly search on Mondays uses these.</p>
            {fields.map(([key, , title, help]) => (
              <label key={key} className="field"><span>{title}</span>
                <textarea rows={5} value={draft[key] ?? ""} onChange={e => { setDraft(d => ({ ...d, [key]: e.target.value })); setSaved(false); }} aria-describedby={`${key}-hint`} />
                <span id={`${key}-hint`} className="hint">{help}{key !== "similarArtists" && !parseList(draft[key]).length && " Empty, so the defaults are used."}</span>
              </label>
            ))}
            {error && <p className="form-err" role="alert">{error}</p>}
            <div className="dlg-actions">
              <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Save settings"}</button>
              <button type="button" className="btn" disabled={busy} onClick={() => setConfirming(true)}>Reset to defaults</button>
              <AnimatePresence>{saved && <motion.span className="muted" role="status" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>Saved</motion.span>}</AnimatePresence>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
      <Modal open={confirming} onClose={() => !busy && setConfirming(false)} label="Reset search settings">
        <h3>Reset to defaults?</h3>
        <p>Areas and phrases go back to the built-in lists, and the similar artists list is cleared.</p>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="row-actions">
          <button className="btn btn-primary" disabled={busy} onClick={reset}>{busy ? "Resetting…" : "Reset"}</button>
          <button className="btn" disabled={busy} onClick={() => setConfirming(false)}>Cancel</button>
        </div>
      </Modal>
    </div>
  );
}

export default function Gigs({ cloud }) {
  const now = Date.now();
  const [decision, setDecision] = useState("all");
  const [month, setMonth] = useState("");
  const gigs = useMemo(() => gigView(cloud.gigs, { now: Date.now(), decision, month }), [cloud.gigs, decision, month]);
  const months = useMemo(() => [...new Set(gigView(cloud.gigs, { now: Date.now() }).map(g => g.date?.slice(0, 7)).filter(Boolean))].sort(), [cloud.gigs]);
  return (
    <div className="gigs">
      <div className="view-head">
        <div>
          <h2 className="view-title">Gigs</h2>
          <p className="view-sub">{runSummary(cloud.gigStatus, now)}</p>
        </div>
      </div>
      <AddGig add={cloud.addGig} />
      <SearchSettings settings={cloud.settings} save={cloud.saveSettings} />
      {cloud.gigs.length > 0 && (
        <div className="gig-filters">
          <div role="group" aria-label="Filter by decision" className="gig-decide">
            {filters.map(f => <button key={f} type="button" className={`view-chip${decision === f ? " on" : ""}`} aria-pressed={decision === f} onClick={() => setDecision(f)}>{label(f)}</button>)}
          </div>
          <label className="gig-month">Month
            <select value={month} onChange={e => setMonth(e.target.value)}>
              <option value="">Any month</option>
              {months.map(m => <option key={m} value={m}>{monthName(m)}</option>)}
            </select>
          </label>
        </div>
      )}
      {gigs.length === 0 ? (
        <Empty title={cloud.gigs.length ? "No gigs match these filters." : "No gigs yet: the weekly search runs on Mondays."} />
      ) : (
        <ul className="gig-list" aria-label="Upcoming gigs, best first">
          <AnimatePresence initial={false}>{gigs.map(g => <Card key={g.id} g={g} decide={cloud.decideGig} />)}</AnimatePresence>
        </ul>
      )}
    </div>
  );
}
