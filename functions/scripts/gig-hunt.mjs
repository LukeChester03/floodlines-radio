// Weekly gig hunt on the maintainer's Mac (launchd: see gig-hunt.plist).
// Needs Application Default Credentials: `gcloud auth application-default login`.
// Writes to the production Firestore: never run it from an agent.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { firestoreStore } from "../store.js";
import { gigHunt } from "../hunt.js";

const projectId = JSON.parse(readFileSync(new URL("../../.firebaserc", import.meta.url), "utf8")).projects.default;
initializeApp({ credential: applicationDefault(), projectId });

// One headless Claude Code session that can only search and fetch the web; resolves to its answer.
function runSession(prompt) {
  return new Promise((resolve, reject) => {
    const tools = ["WebSearch", "WebFetch"];
    const child = spawn("claude", ["-p", "--tools", ...tools, "--allowedTools", ...tools], { stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`claude exited ${code}: ${err.trim().slice(0, 300)}`))));
    child.stdin.end(prompt);
  });
}

const status = await gigHunt({ store: firestoreStore(getFirestore()), runSession });
console.log(JSON.stringify(status, null, 2));
