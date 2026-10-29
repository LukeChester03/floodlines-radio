// Signs in as the read-only test login and writes a Playwright storage state for ui-evidence screenshots.
// Credentials come from ~/.config/floodlines-radio/test-login.env (TEST_LOGIN_ENV overrides the path), never the repo.
// Prints the storage-state path as the last stdout line; everything else goes to stderr.
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

// Firebase's web SDK restores a user it finds under this localStorage key on start.
export function storageState(baseUrl, apiKey, user) {
  return {
    cookies: [],
    origins: [{
      origin: baseUrl.replace(/\/+$/, ""),
      localStorage: [{ name: `firebase:authUser:${apiKey}:[DEFAULT]`, value: JSON.stringify(user) }],
    }],
  };
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function main() {
  const baseUrl = process.env.UI_EVIDENCE_BASE_URL;
  if (!baseUrl) fail("Set UI_EVIDENCE_BASE_URL to the app's URL, e.g. http://127.0.0.1:5173");

  const envPath = process.env.TEST_LOGIN_ENV || join(homedir(), ".config", "floodlines-radio", "test-login.env");
  if (!existsSync(envPath)) fail(`No credentials file at ${envPath}. Create test-login.env with TEST_EMAIL=... and TEST_PASSWORD=... lines, then chmod 600 it.`);
  const env = Object.fromEntries(readFileSync(envPath, "utf8").split("\n")
    .map((line) => line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)).filter(Boolean).map((m) => [m[1], m[2]]));
  const missing = ["TEST_EMAIL", "TEST_PASSWORD"].filter((k) => !env[k]);
  if (missing.length) fail(`${envPath} is missing ${missing.join(" and ")}`);

  const config = JSON.parse(readFileSync(new URL("../src/firebase-config.json", import.meta.url), "utf8"));
  const { initializeApp } = await import("firebase/app");
  const { getAuth, signInWithEmailAndPassword } = await import("firebase/auth");
  const { user } = await signInWithEmailAndPassword(getAuth(initializeApp(config)), env.TEST_EMAIL, env.TEST_PASSWORD)
    .catch((e) => fail(`Sign-in as ${env.TEST_EMAIL} failed: ${e.code || e.message}`));

  const out = join(mkdtempSync(join(tmpdir(), "ui-evidence-")), "storage-state.json");
  writeFileSync(out, JSON.stringify(storageState(baseUrl, config.apiKey, user.toJSON()), null, 2));
  console.log(out);
  process.exit(0);
}

if (import.meta.main) await main();
