import { useEffect, useState } from "react";
import { songSlug } from "../songs.js";
import { Modal } from "../ui/bits.jsx";

const swatches = ["#8E3B6B", "#3D6BFF", "#E2582B", "#2F9E6B", "#C79A1E", "#6E56CF"];
const empty = { id: "", title: "", released: "", link: "", blurb: "", cover: "", color: swatches[2] };

// Add or edit a single. Each song is its own campaign with its own statuses per station.
export default function SongForm({ value, songs, onSave, onClose }) {
  const editing = value && value !== "new";
  const [f, setF] = useState(empty);
  const [err, setErr] = useState("");
  useEffect(() => { if (value) { setF(editing ? value : empty); setErr(""); } }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = patch => setF(x => ({ ...x, ...patch }));

  const onCover = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 400_000) { setErr("That image is over 400 KB. Use a smaller cover, or paste a link to it instead."); return; }
    const r = new FileReader();
    r.onload = () => set({ cover: r.result });
    r.readAsDataURL(file);
  };
  const submit = e => {
    e.preventDefault();
    if (!f.title.trim()) return setErr("Give the song a title.");
    if (!/^https?:\/\//.test(f.link.trim())) return setErr("Add a streaming link starting with https:// so stations can listen.");
    let id = editing ? f.id : songSlug(f.title);
    while (!editing && songs.some(s => s.id === id)) id += "-2";
    onSave({ ...f, id, title: f.title.trim(), link: f.link.trim() });
  };

  return (
    <Modal open={!!value} onClose={onClose} label={editing ? `Edit ${f.title}` : "Add a new single"} className="songform">
      <form onSubmit={submit} noValidate>
        <h2 className="dlg-title">{editing ? `Edit ${value.title}` : "Add a new single"}</h2>
        <p className="dlg-sub">Each song gets its own campaign, so you can see exactly which stations have heard which song.</p>
        <label className="field"><span>Title</span><input value={f.title} onChange={e => set({ title: e.target.value })} required /></label>
        <div className="field-row">
          <label className="field"><span>Release date</span><input type="date" value={f.released} onChange={e => set({ released: e.target.value })} /></label>
          <label className="field grow"><span>Streaming link (Spotify, Bandcamp, SoundCloud…)</span><input type="url" value={f.link} onChange={e => set({ link: e.target.value })} placeholder="https://" required /></label>
        </div>
        <label className="field"><span>One or two sentences about the song, used in pitches</span><textarea rows={3} value={f.blurb} onChange={e => set({ blurb: e.target.value })} /></label>
        <div className="field-row">
          <label className="field grow"><span>Cover image link (optional)</span><input value={f.cover?.startsWith("data:") ? "" : f.cover} onChange={e => set({ cover: e.target.value })} placeholder="https://… or upload" /></label>
          <label className="field"><span>Or upload</span><input type="file" accept="image/*" onChange={onCover} /></label>
        </div>
        <fieldset className="field">
          <legend>Colour on the site</legend>
          <div className="swatches">
            {swatches.map(c => (
              <button type="button" key={c} className={`swatch${f.color === c ? " on" : ""}`} style={{ background: c }} aria-label={`Colour ${c}`} aria-pressed={f.color === c} onClick={() => set({ color: c })} />
            ))}
          </div>
        </fieldset>
        {err && <p className="form-err" role="alert">{err}</p>}
        <div className="dlg-actions">
          <button type="submit" className="btn btn-primary">{editing ? "Save changes" : "Add single"}</button>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
