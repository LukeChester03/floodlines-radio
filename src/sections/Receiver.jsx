import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { animate, motion, useAnimationFrame, useMotionValue, useReducedMotion, useScroll, useTransform, useVelocity } from "motion/react";

export const bands = [
  { key: "all", label: "All", freq: "87.5" },
  { key: "uk", label: "UK", freq: "90.2" },
  { key: "ireland", label: "IRL", freq: "93.1" },
  { key: "us", label: "USA", freq: "96.4" },
  { key: "canada", label: "CAN", freq: "99.0" },
  { key: "europe", label: "EUR", freq: "101.7" },
  { key: "ausnz", label: "AUS/NZ", freq: "104.3" },
  { key: "world", label: "WORLD", freq: "107.9" },
];
const bandName = { all: "Everywhere", uk: "United Kingdom", ireland: "Ireland", us: "United States", canada: "Canada", europe: "Europe", ausnz: "Australia & NZ", world: "Rest of the world" };

// An analogue VU meter whose needle dances on its own and kicks harder when you scroll
function VU({ label, seed }) {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const vel = useVelocity(scrollY);
  const level = useMotionValue(0.2);
  const target = useRef(0.3);
  const t0 = useRef(0);
  useAnimationFrame((t, dt) => {
    if (reduce) return;
    if (t - t0.current > 90 + ((seed * 37) % 60)) {
      t0.current = t;
      const kick = Math.min(Math.abs(vel.get()) / 3000, 0.5);
      target.current = Math.min(1, 0.15 + Math.random() * 0.55 + kick);
    }
    level.set(level.get() + (target.current - level.get()) * Math.min(1, dt / 70));
  });
  const rotate = useTransform(level, [0, 1], [-48, 48]);
  return (
    <div className="vu">
      <svg viewBox="0 0 120 70" aria-hidden="true">
        <path d="M14 58 A 50 50 0 0 1 106 58" className="vu-arc" />
        <path d="M86 23 A 50 50 0 0 1 106 58" className="vu-red" />
        {Array.from({ length: 11 }, (_, i) => {
          const a = (-48 + i * 9.6) * Math.PI / 180;
          return <line key={i} x1={60 + Math.sin(a) * 44} y1={62 - Math.cos(a) * 44} x2={60 + Math.sin(a) * 50} y2={62 - Math.cos(a) * 50} className={i > 7 ? "vu-tick red" : "vu-tick"} />;
        })}
        <text x="60" y="44" className="vu-text">VU</text>
      </svg>
      <motion.span className="vu-needle" style={{ rotate }} />
      <span className="vu-label">{label}</span>
    </div>
  );
}

// Round tuning knob. Spins with the dial pointer and can be dragged itself.
function Knob({ x, onPan, onPanEnd }) {
  const rotate = useTransform(x, v => v * 0.9);
  return (
    <div className="knob-wrap">
      <motion.div
        className="knob"
        style={{ rotate }}
        onPan={(_, info) => onPan(info.delta.x + -info.delta.y)}
        onPanEnd={onPanEnd}
        whileTap={{ scale: 0.97 }}
        aria-hidden="true"
      >
        <span className="knob-dot" />
      </motion.div>
      <span className="plate-label">Tuning</span>
    </div>
  );
}

export function Keys({ options, value, onChange, label }) {
  return (
    <div className="keys" role="group" aria-label={label}>
      {options.map(([k, l]) => {
        const on = value === k;
        return (
          <motion.button
            key={k}
            className={`key${on ? " is-on" : ""}`}
            aria-pressed={on}
            onClick={() => onChange(k)}
            animate={{ y: on ? 3 : 0 }}
            whileTap={{ y: 4 }}
            transition={{ type: "spring", stiffness: 600, damping: 30 }}
          >
            <span className="key-led" />
            <span className="key-text">{l}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

export default function Receiver({ region, onRegion, counts, children, powered }) {
  const track = useRef(null);
  const [width, setWidth] = useState(0);
  const x = useMotionValue(0);
  const [moving, setMoving] = useState(false);
  const index = Math.max(0, bands.findIndex(b => b.key === region));
  const step = width / (bands.length - 1);

  useLayoutEffect(() => {
    const m = () => setWidth(track.current.offsetWidth);
    m();
    window.addEventListener("resize", m);
    return () => window.removeEventListener("resize", m);
  }, []);

  useEffect(() => {
    if (!moving && width) animate(x, index * step, { type: "spring", stiffness: 220, damping: 24 });
  }, [index, step, width, moving, x]);

  const off = useTransform(x, v => (step ? Math.min(1, Math.abs(v / step - Math.round(v / step)) * 2) : 0));
  const staticOpacity = useTransform(off, [0, 1], [0, 0.85]);
  const lock = useTransform(off, [0, 0.35], [1, 0.2]);

  const settle = () => {
    setMoving(false);
    const i = Math.max(0, Math.min(bands.length - 1, Math.round(x.get() / step)));
    onRegion(bands[i].key);
    animate(x, i * step, { type: "spring", stiffness: 220, damping: 24 });
  };
  const nudge = d => {
    setMoving(true);
    x.set(Math.max(0, Math.min(width, x.get() + d)));
  };
  const onKey = e => {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); onRegion(bands[Math.min(bands.length - 1, index + 1)].key); }
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); onRegion(bands[Math.max(0, index - 1)].key); }
  };

  return (
    <motion.div
      className="receiver"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 70, damping: 16 }}
    >
      <div className="receiver-top">
        <div className="brand-plate">
          <span className="brand">FloodLines</span>
          <span className="model">FL-2026 Pitch Receiver</span>
        </div>

        <div className="led-box" aria-live="polite">
          <span className="led-ghost" aria-hidden="true">888.8</span>
          <motion.span className="led" style={{ opacity: lock }}>{bands[index].freq}</motion.span>
          <span className="led-unit">MHz</span>
          <span className="led-sub">{bandName[region]}: {counts[region] ?? 0} stations</span>
        </div>

        <div className="meters">
          <VU label="L" seed={1} />
          <VU label="R" seed={2} />
        </div>
      </div>

      <div className="dial">
        <motion.div
          className="dial-glass"
          initial={{ opacity: 0.15 }}
          animate={powered ? { opacity: [0.15, 0.9, 0.4, 1] } : {}}
          transition={{ duration: 1.1, times: [0, 0.3, 0.45, 1] }}
        >
          <motion.div className="dial-static" style={{ opacity: staticOpacity }} aria-hidden="true" />
          <div className="dial-scale" aria-hidden="true">
            {["88", "90", "92", "94", "96", "98", "100", "102", "104", "106", "108"].map(n => <span key={n}>{n}</span>)}
          </div>
          <div className="dial-ticks" aria-hidden="true">
            {Array.from({ length: 61 }, (_, i) => <span key={i} className={i % 6 === 0 ? "major" : ""} />)}
          </div>
          <div className="dial-track" ref={track}>
            {bands.map((b, i) => (
              <button
                key={b.key}
                className={`dial-stop${b.key === region ? " is-on" : ""}`}
                style={{ left: `${(i / (bands.length - 1)) * 100}%` }}
                onClick={() => onRegion(b.key)}
                aria-pressed={b.key === region}
                aria-label={`${bandName[b.key]}, ${counts[b.key] ?? 0} stations`}
              >
                {b.label}
                <small>{counts[b.key] ?? 0}</small>
              </button>
            ))}
            <motion.div
              className="pointer"
              style={{ x }}
              drag="x"
              dragConstraints={track}
              dragElastic={0.04}
              dragMomentum={false}
              onDragStart={() => setMoving(true)}
              onDragEnd={settle}
              role="slider"
              tabIndex={0}
              aria-label="Tune to a region"
              aria-valuemin={0}
              aria-valuemax={bands.length - 1}
              aria-valuenow={index}
              aria-valuetext={bandName[region]}
              onKeyDown={onKey}
            />
          </div>
        </motion.div>
      </div>

      <div className="receiver-bottom">
        <Knob x={x} onPan={nudge} onPanEnd={settle} />
        <div className="controls">{children}</div>
      </div>
    </motion.div>
  );
}
