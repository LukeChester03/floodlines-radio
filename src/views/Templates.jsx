import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { RotateCcw } from "lucide-react";
import { band, fill, placeholders, templates as baseTemplates } from "../songs.js";
import { reachable } from "../../functions/core/stations.js";
import { useLocal } from "../store.js";
import { withTemplate } from "../crm.js";
import { Modal } from "../ui/bits.jsx";

const KINDS = [
  ["pitch", "Pitch", "The first email to a station."],
  ["followup", "Follow-up", "The nudge sent when a station hasn't replied."],
];

// Edits save to the shared settings, so the Mailer and Go live pick them up
export default function Templates({ stations, songs, song, cloud }) {
  const tpls = cloud.settings.templates || baseTemplates;
  const [signoff] = useLocal("fl-signoff", band.signoff);
  const [resetting, setResetting] = useState(null);
  const sample = stations.find(s => reachable(s) && s.email) || stations.find(reachable) || stations[0];
  const save = (kind, patch) => cloud.saveSettings({ templates: withTemplate(tpls, kind, patch) });

  return (
    <div className="templates">
      <div className="view-head">
        <div>
          <h2 className="view-title">Templates</h2>
          <p className="view-sub">The master pitch and follow-up. Changing them rewrites new emails; emails already in the send list keep their own wording.</p>
        </div>
      </div>

      <p className="hint tpl-ph">Placeholders: {placeholders.join(" ")}. {"{name}"} uses the contact's first name where the station publishes one, otherwise "[station] team".</p>

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
    </div>
  );
}
