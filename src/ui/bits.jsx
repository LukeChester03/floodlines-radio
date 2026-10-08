import { useCallback, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
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
      <span className="onair-text">On air</span>
      <span className="sr-only">{lit ? "" : "Nothing waiting to send"}</span>
      {lit && <span className="onair-n">{count}</span>}
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
// guard(): return false to keep the dialog open (e.g. unsaved edits).
export function Modal({ open, onClose, label, className = "", children, side = false, guard }) {
  const ref = useRef(null);
  const opener = useRef(null);
  const tryClose = useCallback(() => { if (!guard || guard()) onClose(); }, [guard, onClose]);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    const t = setTimeout(() => ref.current?.focus(), 30);
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
    const main = document.querySelector(".app-shell");
    main?.setAttribute("inert", "");
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      main?.removeAttribute("inert");
      opener.current?.focus?.();
    };
  }, [open, tryClose]);

  return (
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
    </AnimatePresence>
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
