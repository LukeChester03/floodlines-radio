import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Loader2, Plus, X } from "lucide-react";
import { statusLabel } from "../crm.js";

export const typeLabel = { national: "National", regional: "Regional", community: "Community", student: "Student", college: "College", public: "Public", online: "Online", commercial: "Commercial", show: "Show" };
export const routeLabel = { email: "Email", form: "Form", platform: "Uploader", post: "Post", contact: "General contact", none: "No route" };
export const genreLabel = { indie: "Indie/alt/rock", any: "All genres", mixed: "Some shows fit", other: "Other genres", unknown: "Not checked" };
export const tierLabel = { start: "Start here", strong: "Strong", worth: "Worth a go", long: "Long shot" };
export const groupLabel = { uk: "UK", ireland: "Ireland", us: "USA", canada: "Canada", europe: "Europe", ausnz: "Aus & NZ", world: "Elsewhere" };
export const flag = cc => (cc && cc.length === 2 ? String.fromCodePoint(...[...cc].map(c => 127397 + c.charCodeAt(0))) : "");

export function StatusTag({ status, small }) {
  return <span className={`stag st-${status}${small ? " small" : ""}`}>{statusLabel[status] || status}</span>;
}

export function Meter({ value, label }) {
  if (value == null) return <span className="meter-none" aria-label={`${label}: not ranked`}>—</span>;
  return (
    <span className="meter" role="img" aria-label={`${label}: ${value} out of 5`} title={`${label}: ${value}/5`}>
      {[1, 2, 3, 4, 5].map(n => <span key={n} className={n <= value ? `on l${n}` : ""} />)}
    </span>
  );
}

// The studio's ON AIR lamp. Lit when there are emails waiting in the send list.
export function OnAir({ count, onClick }) {
  const lit = count > 0;
  return (
    <button className={`onair${lit ? " lit" : ""}`} onClick={onClick} aria-label={lit ? `${count} emails waiting in the send list` : "Send list is empty"}>
      <motion.span
        className="onair-glow"
        animate={lit ? { opacity: [0.55, 1, 0.8, 1] } : { opacity: 0 }}
        transition={lit ? { duration: 2.4, repeat: Infinity, times: [0, 0.2, 0.5, 1] } : { duration: 0.3 }}
        aria-hidden="true"
      />
      <span className="onair-text">{lit ? "On air" : "Off air"}</span>
      {lit && <span className="onair-n">{count} to send</span>}
    </button>
  );
}

export function Sleeve({ song, size = 64 }) {
  return (
    <span className="sleeve" style={{ width: size, height: size, "--song": song.color || "#8E3B6B" }} aria-hidden="true">
      {song.cover ? <img src={song.cover} alt="" width={size} height={size} /> : <span className="sleeve-blank">{song.title.slice(0, 1)}</span>}
    </span>
  );
}

// Dialog shell: scrim, escape to close, focus moved in and trapped, focus returned on close.
// Portalled to <body> so it sits outside the .app-shell it makes inert; the portal wraps
// AnimatePresence so exit animations still run.
// guard(): return false to keep the dialog open (e.g. unsaved edits).
// focusOn: a ref to take focus on open, in place of the dialog itself.
export function Modal({ open, onClose, label, className = "", children, side = false, guard, focusOn }) {
  const ref = useRef(null);
  const opener = useRef(null);
  // Latest handlers kept in refs so the focus effect runs once per open, not on every keystroke
  const handlers = useRef({ onClose, guard });
  handlers.current = { onClose, guard };
  const tryClose = useCallback(() => {
    const { onClose: close, guard: g } = handlers.current;
    if (!g || g()) close();
  }, []);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    const t = setTimeout(() => (focusOn?.current ?? ref.current)?.focus(), 30);
    const onKey = e => {
      if (e.key === "Escape") { e.preventDefault(); tryClose(); return; }
      if (e.key !== "Tab" || !ref.current) return;
      const f = [...ref.current.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])')].filter(el => el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f.at(-1);
      if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    const shell = document.querySelector(".app-shell");
    shell?.setAttribute("inert", "");
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      shell?.removeAttribute("inert");
      // Return focus to whatever opened the dialog, or to the main area if that's gone
      // (checked after exit animations, since the opener may be removed, e.g. the bulk bar after approving)
      const back = opener.current;
      setTimeout(() => (back && back.isConnected && !back.closest(".bulkbar") ? back : document.getElementById("main"))?.focus?.(), 60);
    };
  }, [open, tryClose, focusOn]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="scrim" onClick={tryClose} />
          <motion.div
            ref={ref}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className={`${side ? "sheet" : "dialog"} ${className}`}
            initial={side ? { x: "100%" } : { y: 40, opacity: 0, scale: 0.98 }}
            animate={side ? { x: 0 } : { y: 0, opacity: 1, scale: 1 }}
            exit={side ? { x: "100%" } : { y: 30, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 30 }}
          >
            <button className="icon-btn close" onClick={tryClose} aria-label="Close"><X size={20} /></button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// Side panel on Modal: a heading, a body that scrolls and a footer that stays pinned
export function Overlay({ open, onClose, label, eyebrow, title, footer, guard, focusOn, className = "", children }) {
  return (
    <Modal open={open} onClose={onClose} label={label} guard={guard} focusOn={focusOn} className={`ov ${className}`} side>
      <header className="ov-head">
        {eyebrow && <p className="ov-eyebrow">{eyebrow}</p>}
        <h2 className="sheet-title">{title}</h2>
      </header>
      <div className="ov-body" tabIndex={0}>{children}</div>
      {footer && <footer className="ov-foot">{footer}</footer>}
    </Modal>
  );
}

// An Add button and the form it opens in an Overlay. A field with rows is a textarea, any other is the link.
export function AddOverlay({ button, title, hint, fields, submit, fallback, add }) {
  const blank = () => Object.fromEntries(fields.map(f => [f.name, ""]));
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const formId = useId();
  const link = useRef(null);
  const close = () => { setOpen(false); setError(""); };
  const set = name => e => setValues(v => ({ ...v, [name]: e.target.value }));
  const save = async e => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await add(...fields.map(f => (f.rows ? values[f.name] : values[f.name].trim())));
      setValues(blank());
      close();
    } catch (err) {
      setError(err.message || fallback);
      link.current?.focus();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="gig-add">
      {/* Safari doesn't focus a clicked button, and Modal returns focus to whatever had it */}
      <button type="button" className="btn" aria-haspopup="dialog" onClick={e => { e.currentTarget.focus(); setOpen(true); }}><Plus size={14} aria-hidden="true" /> {button}</button>
      <Overlay
        open={open}
        onClose={close}
        guard={() => !busy}
        label={title}
        title={title}
        focusOn={link}
        className="ov-add"
        footer={(
          <>
            {error && <p className="form-err" role="alert">{error}</p>}
            <div className="ov-actions">
              <button type="submit" form={formId} className="btn btn-primary" disabled={busy}>{busy ? <><Loader2 size={16} className="spin" aria-hidden="true" />Adding…</> : submit}</button>
              <button type="button" className="btn" disabled={busy} onClick={close}>Cancel</button>
            </div>
          </>
        )}
      >
        <form id={formId} className="ov-form" onSubmit={save}>
          <p className="ov-hint">{hint}</p>
          {fields.map(({ name, label, rows, ...input }) => (
            <label key={name} className="field"><span>{label}</span>
              {rows
                ? <textarea name={name} rows={rows} value={values[name]} onChange={set(name)} {...input} />
                : <input ref={link} type="url" inputMode="url" name={name} autoComplete="off" spellCheck={false} value={values[name]} onChange={set(name)} required {...input} />}
            </label>
          ))}
        </form>
      </Overlay>
    </div>
  );
}

export function Empty({ title, children, action, dark }) {
  return (
    <div className={`empty${dark ? " on-dark" : ""}`}>
      <p className="empty-title">{title}</p>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
