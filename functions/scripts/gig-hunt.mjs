// Weekly gig hunt on the maintainer's Mac (launchd: see gig-hunt.plist).
// With --pasted, reads the posts pasted with Add a gig instead (every 15 minutes: see gig-pasted.plist).
// With --seed-festivals, loads data/festivals.json once through importFestivals (the maintainer runs this once).
// Needs Application Default Credentials: `gcloud auth application-default login`.
// Writes to the production Firestore: never run it from an agent.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { firestoreStore } from "../store.js";
import { gigHunt, readPasted } from "../hunt.js";
import { importFestivals } from "../festivals.js";
import seed from "../data/festivals.json" with { type: "json" };

const projectId = JSON.parse(readFileSync(new URL("../../.firebaserc", import.meta.url), "utf8")).projects.default;
initializeApp({ credential: applicationDefault(), projectId });

const pasted = process.argv.includes("--pasted");

// One headless Claude Code session that can only search and fetch the web (no tools at all with --pasted); resolves to its answer.
function runSession(prompt) {
  return new Promise((resolve, reject) => {
    const tools = ["WebSearch", "WebFetch"];
    const args = pasted ? ["-p", "--tools", ""] : ["-p", "--tools", ...tools, "--allowedTools", ...tools];
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
const status = process.argv.includes("--seed-festivals")
  ? await importFestivals({ store, festivals: seed })
  : await (pasted ? readPasted : gigHunt)({ store, runSession });
console.log(JSON.stringify(status, null, 2));
