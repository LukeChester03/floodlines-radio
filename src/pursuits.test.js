import test from "node:test";
import assert from "node:assert/strict";
import { activePursuits } from "./pursuits.js";

const now = new Date("2026-11-02T12:00:00Z").getTime();
const run = (data) => activePursuits({ gigs: [], festivals: [], stations: [], ...data }, now);

test("activePursuits lists upcoming interested gigs, leaving out past, booked and undecided ones", () => {
  const gigs = [
    { id: "a", venue: "The Louisiana", title: "Open mic", date: "2026-11-08", decision: "interested" },
    { id: "b", venue: "Old", date: "2026-10-30", decision: "interested" },
    { id: "c", venue: "Booked", date: "2026-11-10", decision: "booked" },
    { id: "d", venue: "Undecided", date: "2026-11-10" },
  ];
  assert.deepEqual(run({ gigs }), [{ kind: "gig", id: "a", song: null, title: "The Louisiana", action: "Apply", date: "2026-11-08", overdue: false, view: "gigs" }]);
});

test("activePursuits lists interested festivals still open and applied ones waiting to hear back", () => {
  const festivals = [
    { id: "open", name: "Open Fest", applyBy: "2026-11-20", decision: "interested" },
    { id: "shut", name: "Shut Fest", applyBy: "2026-10-31", decision: "interested" },
    { id: "sent", name: "Sent Fest", applyBy: "2026-10-01", decision: "applied" },
  ];
  assert.deepEqual(run({ festivals }).map(x => [x.kind, x.id, x.title, x.action, x.date, x.view]), [
    ["festival", "open", "Open Fest", "Apply", "2026-11-20", "festivals"],
    ["festival", "sent", "Sent Fest", "Hear back", null, "festivals"],
  ]);
});

const station = (id, songs) => ({ id, name: `Radio ${id}`, songs });
const stations = [
  station("p", { companion: { status: "pitched", log: [{ at: "2026-10-20T09:00:00Z", type: "pitch" }] } }),
  station("f", { companion: { status: "followed", log: [{ at: "2026-09-01T09:00:00Z", type: "pitch" }, { at: "2026-09-11T09:00:00Z", type: "followup" }, { at: "2026-09-25T09:00:00Z", type: "followup" }] } }),
  station("n", { companion: { status: "new", log: [] } }),
  station("r", { tide: { status: "replied", log: [{ at: "2026-10-28T18:00:00Z", type: "status" }, { at: "2026-10-01T09:00:00Z", type: "pitch" }] } }),
];

test("activePursuits gives a follow-up dated by its due day, overdue when before today", () => {
  const out = run({ stations: [stations[0]] });
  assert.deepEqual(out, [{ kind: "station", id: "p", song: "companion", title: "Radio p", action: "Follow up", date: "2026-10-30", overdue: true, view: "followups" }]);
});

test("activePursuits skips used-up follow-ups and unpitched songs, and asks to answer replies", () => {
  const out = run({ stations: stations.slice(1) });
  assert.deepEqual(out.map(x => [x.id, x.song, x.action, x.date, x.overdue, x.view]), [["r", "tide", "Answer their reply", "2026-10-28", false, "followups"]]);
});

test("activePursuits sorts by date, soonest first, undated last, then by title", () => {
  const out = run({
    gigs: [{ id: "g", venue: "The Louisiana", date: "2026-11-08", decision: "interested" }],
    festivals: [
      { id: "z", name: "Zed Fest", decision: "applied" },
      { id: "a", name: "Ace Fest", decision: "applied" },
      { id: "o", name: "Open Fest", applyBy: "2026-11-20", decision: "interested" },
    ],
    stations,
  });
  assert.deepEqual(out.map(x => [x.title, x.date]), [
    ["Radio r", "2026-10-28"],
    ["Radio p", "2026-10-30"],
    ["The Louisiana", "2026-11-08"],
    ["Open Fest", "2026-11-20"],
    ["Ace Fest", null],
    ["Zed Fest", null],
  ]);
});
