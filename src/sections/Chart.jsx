import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";

export const tiers = [
  { key: "start", title: "Start here", blurb: "Best odds for where you are now, and worth having. Pitch these first." },
  { key: "strong", title: "Strong pitches", blurb: "Good odds or a big prize. Next in line once the first batch is out." },
  { key: "worth", title: "Worth a go", blurb: "Open to you, smaller audiences or longer odds. Good for building plays." },
  { key: "long", title: "Long shots", blurb: "Big or very competitive. Try them once you have more momentum behind you." },
];

export const categories = [
  { key: "bbc-em", title: "BBC Introducing & the East Midlands", blurb: "Your home patch. The BBC route goes through the Uploader, then local teams pass tracks up to national shows." },
  { key: "uk-student", title: "UK student radio", blurb: "Run by students, open to new bands, and a natural fit for a band formed at university." },
  { key: "uk-local", title: "UK community & local", blurb: "Local stations with new-music shows that take acts from outside their area." },
  { key: "uk-national", title: "UK online, national & specialist shows", blurb: "Indie-leaning online stations, specialist shows and national routes." },
  { key: "us-college", title: "US college radio", blurb: "Student-run, music-director led, and open to bands from anywhere." },
  { key: "us-other", title: "US public, community & internet", blurb: "Bigger non-commercial stations and indie internet radio." },
  { key: "canada", title: "Canada", blurb: "Campus and community stations, many open to international acts." },
  { key: "europe", title: "Europe & Ireland", blurb: "Indie and student stations that play English-language music." },
  { key: "ausnz", title: "Australia & New Zealand", blurb: "Community and student stations with strong indie scenes." },
];

const methodLabel = { email: "Takes email", form: "Form", platform: "Platform", post: "Post only" };
const typeLabel = { national: "National", regional: "Regional", community: "Community", student: "Student", college: "College", public: "Public", online: "Online", commercial: "Commercial", show: "Show" };
const flag = cc => (cc && cc.length === 2 ? String.fromCodePoint(...[...cc].map(c => 127397 + c.charCodeAt(0))) : "");

// Five-segment LED bar, lit left to right
function Meter({ label, value }) {
  return (
    <div className="meter" aria-label={`${label}: ${value} out of 5`}>
      <span className="meter-label">{label}</span>
      <span className="meter-bar" aria-hidden="true">
        {[1, 2, 3, 4, 5].map(n => (
          <motion.span
            key={n}
            className={`seg seg-${n}${n <= value ? " on" : ""}`}
            initial={{ opacity: 0.2 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 + n * 0.06 }}
          />
        ))}
      </span>
    </div>
  );
}

function Entry({ s, i, status, selected, onSelect, onDraft }) {
  const [open, setOpen] = useState(false);
  const canEmail = s.emailAllowed;
  return (
    <motion.li
      className={`entry tier-${s.tier}${selected ? " is-selected" : ""}`}
      initial={{ opacity: 0, x: -24 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "0px 0px -40px 0px" }}
      transition={{ type: "spring", stiffness: 160, damping: 22, delay: (i % 6) * 0.04 }}
      layout="position"
    >
      <div className="entry-rank" aria-label={`Rank ${s.rank}`}>
        <span className="rank-num">{s.rank}</span>
        <span className="rank-score">{s.score}<small>/100</small></span>
      </div>

      <div className="entry-main">
        <div className="entry-top">
          <h4 className="entry-name">
            {s.name}
            {s.show && <span className="entry-show">{s.show}</span>}
          </h4>
          <p className="entry-place">{flag(s.country)} {s.region || s.country} · {typeLabel[s.type] || s.type}</p>
        </div>
        <ul className="reasons">
          {s.reasons.map(r => <li key={r}>{r}</li>)}
          {s.paid && <li className="reason-warn">Paid route</li>}
        </ul>
        {s.pitchTip && <p className="tip"><b>Tip:</b> {s.pitchTip}</p>}
        <button className="details-toggle" aria-expanded={open} onClick={() => setOpen(o => !o)}>
          {open ? "Hide their rules" : "Their rules"}
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div className="details" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
              <p>{s.instructions}</p>
              {s.notes && <p className="details-note">{s.notes}</p>}
              <a href={s.sourceUrl} target="_blank" rel="noopener">Their submission page</a>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="entry-side">
        <Meter label="Chance" value={s.chance} />
        <Meter label="Value" value={s.value} />
        <span className={`route route-${s.method}`}>{methodLabel[s.method] || s.method}</span>
        {status && <span className={`state state-${status}`}>{status === "sent" ? "Sent" : "In your mixtape"}</span>}
        <div className="entry-actions">
          {canEmail && (
            <>
              <label className="pick">
                <input type="checkbox" checked={selected} onChange={() => onSelect(s.id)} />
                <span>Select</span>
              </label>
              <motion.button className="chip chip-go" onClick={() => onDraft([s.id])} whileTap={{ scale: 0.93 }}>
                {status ? "Edit pitch" : "Draft pitch"}
              </motion.button>
            </>
          )}
          {!canEmail && (s.formUrl || s.sourceUrl) && (
            <a className="chip" href={s.formUrl || s.sourceUrl} target="_blank" rel="noopener">
              {s.method === "platform" ? "Open the uploader" : s.method === "post" ? "See where to post" : "Open their form"}
            </a>
          )}
        </div>
      </div>
    </motion.li>
  );
}

function Group({ g, list, accent, statuses, selected, onSelect, onDraft, index }) {
  const [shown, setShown] = useState(12);
  if (!list.length) return null;
  return (
    <section className={`group group-${accent}`} aria-labelledby={`g-${g.key}`}>
      <motion.header
        className="group-head"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
      >
        <span className="group-index">{String(index + 1).padStart(2, "0")}</span>
        <div>
          <h3 id={`g-${g.key}`}>{g.title} <span className="group-count">{list.length}</span></h3>
          <p>{g.blurb}</p>
        </div>
      </motion.header>
      <ol className="entries">
        {list.slice(0, shown).map((s, i) => (
          <Entry key={s.id} s={s} i={i} status={statuses[s.id]} selected={selected.includes(s.id)} onSelect={onSelect} onDraft={onDraft} />
        ))}
      </ol>
      {list.length > shown && (
        <button className="more" onClick={() => setShown(list.length)}>Show all {list.length} in {g.title}</button>
      )}
    </section>
  );
}

export default function Chart({ list, groupBy, statuses, selected, onSelect, onDraft }) {
  const groups = groupBy === "tier" ? tiers : categories;
  const key = groupBy === "tier" ? "tier" : "category";
  if (!list.length) return <p className="chart-empty">No stations match. Try another region or clear the search.</p>;
  return (
    <div className="chart">
      {groups.map((g, i) => (
        <Group
          key={`${groupBy}-${g.key}`}
          g={g}
          index={i}
          accent={groupBy === "tier" ? g.key : "cat"}
          list={list.filter(s => s[key] === g.key)}
          statuses={statuses}
          selected={selected}
          onSelect={onSelect}
          onDraft={onDraft}
        />
      ))}
    </div>
  );
}
