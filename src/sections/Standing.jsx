import { motion } from "motion/react";

const facts = [
  ["Singles out", "2", "Final Fear and Companion, both self-produced"],
  ["Instagram", "218", "followers, a few hundred monthly listeners"],
  ["Radio so far", "BBC", "Introducing East Midlands, plus an LCR interview"],
  ["Team", "0", "no label, manager, PR or plugger yet"],
];

const steps = [
  ["Home patch first", "Upload both singles to BBC Introducing and pitch East Midlands, student and local stations. These are the most likely yeses, and BBC Introducing can pass tracks up to national shows."],
  ["UK indie online and specialist shows", "Stations like these build a UK audience you can turn into gig crowds."],
  ["US college and international indie", "Easy to get onto and good for credibility and play counts. Lower priority for UK gigs, so batch these once the UK pitches are out."],
  ["Big national stations", "Long shots for a cold pitch today. Most bands reach them through BBC Introducing or a plugger."],
];

// Where FloodLines are now, and the order the chart is built around
export default function Standing() {
  return (
    <section className="standing" aria-labelledby="standing-h">
      <motion.div
        className="report"
        initial={{ opacity: 0, rotate: -2, y: 40 }}
        whileInView={{ opacity: 1, rotate: -1, y: 0 }}
        viewport={{ once: true }}
        transition={{ type: "spring", stiffness: 90, damping: 16 }}
      >
        <h2 id="standing-h">Where you stand</h2>
        <dl className="facts">
          {facts.map(([k, big, small]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd><b>{big}</b> {small}</dd>
            </div>
          ))}
        </dl>
        <p className="report-note">The chart below scores every station on two things for a band at this stage: your <b>chance</b> of getting played from a cold pitch, and the <b>value</b> of that play (reach, influence and how much it helps UK gigs). Score = chance × 12 + value × 8.</p>
      </motion.div>

      <ol className="ladder">
        {steps.map(([title, body], i) => (
          <motion.li
            key={title}
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 110, damping: 18, delay: i * 0.1 }}
          >
            <span className="rung">{i + 1}</span>
            <div>
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}
