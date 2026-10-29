// Weekly gig hunt on the maintainer's Mac (launchd: see gig-hunt.plist).
// With --pasted, reads the posts pasted with Add a gig and the festivals pasted with Add a festival instead (every 15 minutes: see gig-pasted.plist).
// With --seed-festivals, loads data/festivals.json once through importFestivals (the maintainer runs this once).
// Needs Application Default Credentials: `gcloud auth application-default login`.
// Writes to the production Firestore: never run it from an agent.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { firestoreStore } from "../store.js";
import { gigHunt, readPasted, readPastedFestivals } from "../hunt.js";
import { importFestivals } from "../festivals.js";
import seed from "../data/festivals.json" with { type: "json" };

const projectId = JSON.parse(readFileSync(new URL("../../.firebaserc", import.meta.url), "utf8")).projects.default;
initializeApp({ credential: applicationDefault(), projectId });

const pasted = process.argv.includes("--pasted");

// One headless Claude Code session that can use only the given tools; resolves to its answer.
function session(tools, prompt) {
  return new Promise((resolve, reject) => {
    const args = tools.length ? ["-p", "--tools", ...tools, "--allowedTools", ...tools] : ["-p", "--tools", ""];
    const child = spawn("claude", args, { stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`claude exited ${code}: ${err.trim().slice(0, 300)}`))));
    child.stdin.end(prompt);
  });
}

const store = firestoreStore(getFirestore());
if (process.argv.includes("--seed-festivals")) {
  console.log(JSON.stringify(await importFestivals({ store, festivals: seed }), null, 2));
} else if (pasted) {
  // Each read in its own try, so one failing doesn't stop the other.
  const reads = [
    [readPasted, (p) => session([], p)],
    [readPastedFestivals, (p) => session(["WebFetch"], p)],
  ];
  for (const [read, runSession] of reads) {
    try {
      console.log(JSON.stringify(await read({ store, runSession }), null, 2));
    } catch (e) {
      console.error(`${read.name} failed: ${e.message}`);
      process.exitCode = 1;
    }
  }
} else {
  console.log(JSON.stringify(await gigHunt({ store, runSession: (p) => session(["WebSearch", "WebFetch"], p) }), null, 2));
}
