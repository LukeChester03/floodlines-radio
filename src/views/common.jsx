import { motion, useReducedMotion } from "motion/react";
import { statusLabel } from "../crm.js";

export const typeLabel = { national: "National", regional: "Regional", community: "Community", student: "Student", college: "College", public: "Public", online: "Online", commercial: "Commercial", show: "Show" };
export const routeLabel = { email: "Email", form: "Form", platform: "Uploader", post: "Post", contact: "General contact", none: "No route found" };
export const genreLabel = { indie: "Indie/alt/rock", any: "All genres", mixed: "Some shows fit", other: "Other genres only", unknown: "Not checked" };
export const tierLabel = { start: "Start here", strong: "Strong", worth: "Worth a go", long: "Long shot" };
export const groupLabel = { uk: "UK", ireland: "Ireland", us: "USA", canada: "Canada", europe: "Europe", ausnz: "Aus & NZ", world: "Elsewhere" };
export const flag = cc => (cc && cc.length === 2 ? String.fromCodePoint(...[...cc].map(c => 127397 + c.charCodeAt(0))) : "");

export function StatusPill({ status }) {
  return <span className={`pill st-${status}`}>{statusLabel[status] || status}</span>;
}

export function Gauge({ value, max = 5, label }) {
  if (value == null) return <span className="gauge-none">—</span>;
  return (
    <span className="gauge" aria-label={`${label} ${value} of ${max}`} title={`${label}: ${value}/${max}`}>
      {Array.from({ length: max }, (_, i) => <span key={i} className={i < value ? "on" : ""} />)}
    </span>
  );
}

// An animated band of water. level is 0–1 of the box height.
export function Water({ level, className = "" }) {
  const reduce = useReducedMotion();
  const wave = "M0 18 C 120 4, 240 32, 360 18 S 600 4, 720 18 S 960 32, 1080 18 S 1320 4, 1440 18 V 60 H 0 Z";
  return (
    <motion.div
      className={`water ${className}`}
      initial={{ height: "0%" }}
      animate={{ height: `${Math.max(4, level * 100)}%` }}
      transition={{ type: "spring", stiffness: 40, damping: 14, delay: 0.2 }}
      aria-hidden="true"
    >
      <motion.svg className="wave" viewBox="0 0 1440 60" preserveAspectRatio="none" animate={reduce ? {} : { x: ["0%", "-50%"] }} transition={{ repeat: Infinity, duration: 9, ease: "linear" }}>
        <path d={wave} />
        <path d={wave} transform="translate(1440 0)" />
      </motion.svg>
      <motion.svg className="wave wave-back" viewBox="0 0 1440 60" preserveAspectRatio="none" animate={reduce ? {} : { x: ["-50%", "0%"] }} transition={{ repeat: Infinity, duration: 13, ease: "linear" }}>
        <path d={wave} />
        <path d={wave} transform="translate(1440 0)" />
      </motion.svg>
    </motion.div>
  );
}

export function Empty({ children }) {
  return <p className="empty">{children}</p>;
}
