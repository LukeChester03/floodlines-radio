import { useEffect } from "react";
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
      {lit && <span className="onair-n">{count}</span>}
    </button>
  );
}

export function Sleeve({ song, size = 64 }) {
  return (
    <span className="sleeve" style={{ width: size, height: size, "--song": song.color || "#8E3B6B" }} aria-hidden="true">
      {song.cover ? <img src={song.cover} alt="" /> : <span className="sleeve-blank">{song.title.slice(0, 1)}</span>}
    </span>
  );
}

// Dialog shell: scrim, escape to close, spring entrance
export function Modal({ open, onClose, label, className = "", children, side = false }) {
  useEffect(() => {
    if (!open) return;
    const onKey = e => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="scrim" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className={`${side ? "sheet" : "dialog"} ${className}`}
            initial={side ? { x: "100%" } : { y: 40, opacity: 0, scale: 0.98 }}
            animate={side ? { x: 0 } : { y: 0, opacity: 1, scale: 1 }}
            exit={side ? { x: "100%" } : { y: 30, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 30 }}
          >
            <button className="icon-btn close" onClick={onClose} aria-label="Close"><X size={20} /></button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
