import test from "node:test";
import assert from "node:assert/strict";
import { activePursuits, pursuitSections, timingWords } from "./pursuits.js";

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

const overdue = { companion: { status: "pitched", log: [{ at: "2026-10-05T09:00:00Z", type: "pitch" }] } };

test("activePursuits gives no follow-up for a form station, only for the Email one", () => {
  const out = run({ stations: [{ ...station("form", overdue), route: "form" }, { ...station("mail", overdue), route: "email" }] });
  assert.deepEqual(out.map(x => [x.id, x.action]), [["mail", "Follow up"]]);
});

test("activePursuits still asks to answer a reply from a form station", () => {
  const replied = { companion: { status: "replied", log: [{ at: "2026-10-28T18:00:00Z", type: "status" }] } };
  assert.deepEqual(run({ stations: [{ ...station("form", replied), route: "form" }] }).map(x => x.action), ["Answer their reply"]);
});

const nov4 = new Date("2026-11-04T12:00:00Z").getTime();
const words = (date, overdue = false, at = nov4) => timingWords({ date, overdue }, at);

test("timingWords counts down to a future date", () => {
  assert.equal(words("2026-11-09"), "In 5 days");
  assert.equal(words("2026-11-05"), "In 1 day");
});

test("timingWords says Today on the day", () => {
  assert.equal(words("2026-11-04"), "Today");
});

test("timingWords says how overdue a past date is", () => {
  assert.equal(words("2026-11-01", true), "3 days overdue");
  assert.equal(words("2026-11-03", true), "1 day overdue");
});

test("timingWords says how long ago a past date that isn't overdue was", () => {
  assert.equal(words("2026-11-01"), "3 days ago");
  assert.equal(words("2026-11-03"), "1 day ago");
});

test("timingWords says No date without a date", () => {
  assert.equal(words(null), "No date");
});

test("timingWords compares UTC calendar days", () => {
  assert.equal(words("2026-11-05", false, new Date("2026-11-04T23:59:00Z").getTime()), "In 1 day");
  assert.equal(words("2026-11-05", false, new Date("2026-11-05T00:01:00Z").getTime()), "Today");
});

const gigCard = { kind: "gig", id: "g" };
const festivalCard = { kind: "festival", id: "f" };
const stationCard = { kind: "station", id: "s", song: "tide" };

test("pursuitSections puts Gigs, Festivals, then Stations, whatever order the list came in", () => {
  assert.deepEqual(pursuitSections([stationCard, festivalCard, gigCard]), [
    { kind: "gig", title: "Gigs", view: "gigs", count: 1, cards: [{ ...gigCard, songs: [] }] },
    { kind: "festival", title: "Festivals", view: "festivals", count: 1, cards: [{ ...festivalCard, songs: [] }] },
    { kind: "station", title: "Stations", view: "followups", count: 1, cards: [{ ...stationCard, songs: ["tide"] }] },
  ]);
});

test("pursuitSections leaves out empty sections and keeps cards in their order", () => {
  const second = { kind: "gig", id: "second" };
  assert.deepEqual(pursuitSections([second, gigCard]).map(s => [s.title, s.count, s.cards.map(c => c.id)]), [["Gigs", 2, ["second", "g"]]]);
  assert.deepEqual(pursuitSections([]), []);
});

const followUp = (id, song, date, overdue = false) => ({ kind: "station", id, song, title: `Radio ${id}`, action: "Follow up", date, overdue, view: "followups" });
const stationSection = items => pursuitSections(items).find(s => s.kind === "station");

test("pursuitSections gives a station one card holding all its songs, and counts it once", () => {
  const { count, cards } = stationSection([followUp("a", "final-fear", "2026-11-01"), followUp("a", "companion", "2026-11-02")]);
  assert.equal(count, 1);
  assert.deepEqual(cards.map(c => [c.id, c.songs]), [["a", ["final-fear", "companion"]]]);
});

test("pursuitSections leads a station card with its soonest item", () => {
  const { cards: [card] } = stationSection([followUp("a", "tide", "2026-11-10"), followUp("a", "companion", "2026-11-01", true)]);
  assert.deepEqual([card.date, card.overdue], ["2026-11-01", true]);
});

test("pursuitSections doesn't merge gigs or festivals that share nothing but a kind", () => {
  const [gigs] = pursuitSections([{ kind: "gig", id: "x" }, { kind: "gig", id: "y" }]);
  assert.deepEqual(gigs.cards.map(c => [c.id, c.songs]), [["x", []], ["y", []]]);
});

test("pursuitSections leads a station card with its reply, even when a follow-up is sooner and overdue", () => {
  const reply = { ...followUp("a", "tide", "2026-11-03"), action: "Answer their reply" };
  const { cards: [card] } = stationSection([followUp("a", "companion", "2026-11-01", true), reply]);
  assert.deepEqual([card.action, card.date, card.overdue], ["Answer their reply", "2026-11-03", false]);
  assert.deepEqual([...card.songs].sort(), ["companion", "tide"]);
});

test("pursuitSections picks the soonest of several replies", () => {
  const reply = (song, date) => ({ ...followUp("a", song, date), action: "Answer their reply" });
  const { cards: [card] } = stationSection([reply("tide", "2026-11-09"), followUp("a", "x", "2026-11-01"), reply("companion", "2026-11-03")]);
  assert.equal(card.date, "2026-11-03");
});

test("pursuitSections sorts station cards by their lead date, after merging", () => {
  const reply = { ...followUp("a", "tide", "2026-11-08"), action: "Answer their reply" };
  const { cards } = stationSection([followUp("a", "companion", "2026-11-01"), followUp("b", "tide", "2026-11-05"), reply]);
  assert.deepEqual(cards.map(c => c.id), ["b", "a"]);
});
