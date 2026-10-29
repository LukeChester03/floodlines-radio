import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FileText, RotateCcw, Upload } from "lucide-react";
import { band, fill, placeholders, templates as baseTemplates } from "../songs.js";
import { reachable } from "../../functions/core/stations.js";
import { useLocal } from "../store.js";
import { checkEpkFile, checkLogoFile, logoRecord, withTemplate } from "../crm.js";
import { Modal } from "../ui/bits.jsx";
import { renderSignature, signatureSetting } from "../signature.js";

const SIG_EXAMPLE = `Kind regards,
{logo}
**Listen & Connect**
[Spotify](https://…)
[Instagram](https://…)

**Contact**
[floodlinesbanduk@gmail.com](mailto:floodlinesbanduk@gmail.com)`;

const KINDS = [
  ["pitch", "Pitch", "The first email to a station."],
  ["followup", "Follow-up", "The nudge sent when a station hasn't replied."],
];

// Edits save to the shared settings, so the Mailer and Go live pick them up
export default function Templates({ stations, songs, song, cloud }) {
  const tpls = cloud.settings.templates || baseTemplates;
  const [signoff] = useLocal("fl-signoff", band.signoff);
  const [resetting, setResetting] = useState(null);
  const epk = cloud.settings.epk;
  const [removing, setRemoving] = useState(false);
  const [progress, setProgress] = useState(null);
  const [epkError, setEpkError] = useState(null);
  const pick = useRef(null);
  const upload = async e => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const why = checkEpkFile(file);
    setEpkError(why);
    if (why) return;
    setProgress(0);
    try { await cloud.uploadEpk(file, setProgress); } catch (err) { setEpkError(`Couldn't upload that (${err.code || err.message}).`); }
    setProgress(null);
  };
  const remove = async () => {
    setRemoving(false);
    try { await cloud.removeEpk(); setEpkError(null); } catch (err) { setEpkError(`Couldn't remove that (${err.code || err.message}).`); }
  };
  const sample = stations.find(s => reachable(s) && s.email) || stations.find(reachable) || stations[0];
  const save = (kind, patch) => cloud.saveSettings({ templates: withTemplate(tpls, kind, patch) });
  const [sigSource, setSigSource] = useState(cloud.settings.signature?.source || "");
  const logo = cloud.settings.logo;
  const logoSrc = logo ? `data:${logo.mimeType};base64,${logo.data}` : null;
  const [logoError, setLogoError] = useState(null);
  const [removingLogo, setRemovingLogo] = useState(false);
  const pickLogo = useRef(null);
  const saveLogo = async file => {
    const why = checkLogoFile(file);
    setLogoError(why);
    if (why) return;
    try {
      const url = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
      });
      await cloud.saveSettings({ logo: logoRecord(file, url.slice(url.indexOf(",") + 1), new Date()) });
    } catch (err) { setLogoError(`Couldn't save that (${err.code || err.message}).`); }
  };
  const uploadLogo = e => {
    const file = e.target.files[0];
    e.target.value = "";
    if (file) saveLogo(file);
  };
  // Only a pasted file counts; pasted text is ignored
  const pasteLogo = e => {
    const file = [...e.clipboardData.items].find(i => i.kind === "file")?.getAsFile();
    if (!file) return;
    e.preventDefault();
    saveLogo(file);
  };
  const removeLogo = async () => {
    setRemovingLogo(false);
    try { await cloud.saveSettings({ logo: null }); setLogoError(null); } catch (err) { setLogoError(`Couldn't remove that (${err.code || err.message}).`); }
  };
  const sigHtml = sigSource.trim() ? renderSignature(sigSource, { logoSrc }).html : "";
  const hasLogoLine = sigSource.split(/\r?\n/).some(l => l.trim() === "{logo}");
  const saveSig = source => { setSigSource(source); cloud.saveSettings({ signature: signatureSetting(source) }); };

  return (
    <div className="templates">
      <div className="view-head">
        <div>
          <h2 className="view-title">Templates</h2>
          <p className="view-sub">The master pitch and follow-up. Changing them rewrites new emails; emails already in the send list keep their own wording.</p>
        </div>
      </div>

      <p className="hint tpl-ph">Placeholders: {placeholders.join(" ")}. {"{name}"} uses the contact's first name where the station publishes one, otherwise "[station] team".</p>

      <section className="card-panel epk-card" aria-labelledby="epk-h">
        <h3 className="dlg-title" id="epk-h">EPK</h3>
        <p className="dlg-sub">Upload your electronic press kit once. Every pitch carries it as an attachment. PDF, ZIP or Word, up to 18 MB.</p>
        <input ref={pick} type="file" hidden aria-label="EPK file" accept=".pdf,.zip,.doc,.docx,application/pdf,application/zip,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={upload} />
        <AnimatePresence mode="wait" initial={false}>
          {epk ? (
            <motion.div key="have" className="epk-file" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <FileText size={22} aria-hidden="true" />
              <div style={{ flex: "1 1 12rem", minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, overflowWrap: "anywhere" }}>{epk.name}</p>
                <p className="hint">{(epk.size / 1048576).toFixed(1)} MB · uploaded {new Date(epk.uploadedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
              </div>
              <button className="btn" disabled={progress !== null} onClick={() => pick.current.click()}><Upload size={14} aria-hidden="true" /> Replace</button>
              <button className="link-btn danger" disabled={progress !== null} onClick={() => setRemoving(true)}>Remove</button>
            </motion.div>
          ) : (
            <motion.div key="none" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <button className="btn btn-primary" disabled={progress !== null} onClick={() => pick.current.click()}><Upload size={14} aria-hidden="true" /> Upload EPK</button>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {progress !== null && (
            <motion.div key="bar" role="progressbar" aria-label="Uploading EPK" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ height: 6, borderRadius: 3, background: "var(--rule)", marginTop: 12, overflow: "hidden" }}>
              <motion.div animate={{ width: `${progress * 100}%` }} style={{ height: "100%", background: "var(--song, currentColor)" }} />
            </motion.div>
          )}
          {epkError && <motion.p key="err" role="alert" className="hint" style={{ color: "#c2321f", marginTop: 10 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{epkError}</motion.p>}
        </AnimatePresence>
      </section>

      <section className="card-panel tpl-card" aria-labelledby="sig-h">
        <h3 className="dlg-title" id="sig-h">Signature</h3>
        <p className="dlg-sub">Added under every pitch and follow-up.</p>
        <div className="tpl-grid">
          <div>
            <label className="field"><span>Signature</span><textarea rows={12} value={sigSource} placeholder={SIG_EXAMPLE} aria-describedby="sig-syntax" onChange={e => saveSig(e.target.value)} /></label>
            <p className="hint" id="sig-syntax">**Bold heading**, [Link text](https://…) for links (also mailto: and tel:), and {"{logo}"} on its own line for the band logo.</p>
            <div className="field"><span id="logo-h">Logo</span></div>
            <input ref={pickLogo} type="file" hidden aria-label="Logo image" accept="image/png,image/jpeg,image/gif" onChange={uploadLogo} />
            <div className="logo-slot" tabIndex={0} role="group" aria-labelledby="logo-h" aria-describedby="logo-help" onPaste={pasteLogo} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: 10, border: "1px dashed var(--rule)", borderRadius: 6 }}>
              {logo ? (
                <>
                  <img src={logoSrc} alt="FloodLines" style={{ maxWidth: 120, maxHeight: 60 }} />
                  <button className="btn" onClick={() => pickLogo.current.click()}><Upload size={14} aria-hidden="true" /> Replace</button>
                  <button className="link-btn danger" onClick={() => setRemovingLogo(true)}>Remove</button>
                </>
              ) : (
                <button className="btn" onClick={() => pickLogo.current.click()}><Upload size={14} aria-hidden="true" /> Upload logo</button>
              )}
              <p className="hint" id="logo-help" style={{ margin: 0 }}>Or click here and paste an image. PNG, JPEG or GIF, up to 200 KB.</p>
            </div>
            {logoError && <p role="alert" className="hint" style={{ color: "#c2321f", marginTop: 10 }}>{logoError}</p>}
            {logo && !hasLogoLine && <p className="hint">Add a line with {"{logo}"} where it should go.</p>}
          </div>
          <div className="tpl-preview" aria-live="polite">
            <p className="hint">Preview</p>
            {sigHtml ? <div className="tpl-sig" dangerouslySetInnerHTML={{ __html: sigHtml }} /> : <p className="hint">No signature yet.</p>}
          </div>
        </div>
      </section>

      {KINDS.map(([kind, label, sub]) => {
        const t = tpls[kind] || baseTemplates[kind];
        const same = t.subject === baseTemplates[kind].subject && t.body === baseTemplates[kind].body;
        const preview = sample ? fill(t, sample, song, songs, { signoff, includeOthers: kind === "pitch" && cloud.settings.includeOthers !== false }) : null;
        return (
          <section key={kind} className="card-panel tpl-card" style={{ "--song": song.color }} aria-labelledby={`tpl-${kind}`}>
            <h3 className="dlg-title" id={`tpl-${kind}`}>{label}</h3>
            <p className="dlg-sub">{sub}</p>
            <div className="tpl-grid">
              <div>
                <label className="field"><span>Subject</span><input value={t.subject} onChange={e => save(kind, { subject: e.target.value })} /></label>
                <label className="field"><span>Body</span><textarea rows={12} value={t.body} onChange={e => save(kind, { body: e.target.value })} /></label>
                <AnimatePresence initial={false}>
                  {!same && (
                    <motion.button key="reset" className="link-btn" onClick={() => setResetting(kind)} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                      <RotateCcw size={14} aria-hidden="true" /> Reset to original
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
              <div className="tpl-preview" aria-live="polite">
                <p className="hint">Preview{sample ? <> for {sample.name}, pitching {song.title}</> : ""}</p>
                {preview && (
                  <motion.div key={preview.subject + preview.body} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
                    <p className="tpl-subject">{preview.subject}</p>
                    <pre className="tpl-body">{preview.body}</pre>
                    {sigHtml && <div className="tpl-sig" dangerouslySetInnerHTML={{ __html: sigHtml }} />}
                  </motion.div>
                )}
              </div>
            </div>
          </section>
        );
      })}

      <Modal open={!!resetting} onClose={() => setResetting(null)} label="Reset template">
        <h2 className="dlg-title">Reset the {resetting === "followup" ? "follow-up" : "pitch"}?</h2>
        <p className="dlg-sub">This puts back the original wording and loses your edits to it. Emails already in the send list aren't changed.</p>
        <div className="dlg-actions">
          <button className="btn btn-primary" onClick={() => { save(resetting, "reset"); setResetting(null); }}>Reset to original</button>
          <button className="btn" onClick={() => setResetting(null)}>Keep my version</button>
        </div>
      </Modal>

      <Modal open={removingLogo} onClose={() => setRemovingLogo(false)} label="Remove logo">
        <h2 className="dlg-title">Remove the logo?</h2>
        <p className="dlg-sub">The {"{logo}"} line in the signature will show nothing until you add another.</p>
        <div className="dlg-actions">
          <button className="btn btn-primary" onClick={removeLogo}>Remove logo</button>
          <button className="btn" onClick={() => setRemovingLogo(false)}>Keep it</button>
        </div>
      </Modal>

      <Modal open={removing} onClose={() => setRemoving(false)} label="Remove EPK">
        <h2 className="dlg-title">Remove the EPK?</h2>
        <p className="dlg-sub">New pitches will go out without an attachment until you upload another.</p>
        <div className="dlg-actions">
          <button className="btn btn-primary" onClick={remove}>Remove EPK</button>
          <button className="btn" onClick={() => setRemoving(false)}>Keep it</button>
        </div>
      </Modal>
    </div>
  );
}
