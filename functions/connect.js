import { BAND_EMAIL } from "./core/band.js";

const SCOPES = "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly";

export function consentUrl({ clientId, redirectUri }) {
  const q = new URLSearchParams({
    client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope: SCOPES,
    access_type: "offline", prompt: "consent", login_hint: BAND_EMAIL,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

// Only the band's own account may be connected; the refresh token goes to Secret Manager, never Firestore or the browser.
export async function handleCallback({ code }, { exchangeCode, writeSecret, store, now = Date.now }) {
  const { email, refreshToken } = await exchangeCode(code);
  if (String(email).toLowerCase() !== BAND_EMAIL) throw new Error("That Google account is not the band account");
  await writeSecret(refreshToken);
  await store.setStatus({ connected: BAND_EMAIL, needsReconnect: false, connectedAt: new Date(now()).toISOString() });
}

export function googleExchange({ clientId, clientSecret, redirectUri }) {
  return async (code) => {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    });
    const t = await res.json();
    if (!res.ok || !t.refresh_token) throw new Error("Google did not return a refresh token");
    const profile = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", { headers: { Authorization: `Bearer ${t.access_token}` } });
    if (!profile.ok) throw new Error("Could not read the consenting account");
    return { email: (await profile.json()).emailAddress, refreshToken: t.refresh_token };
  };
}

// Adds a new version of the secret via the REST API, using the function's own credentials.
export function secretWriter({ secret, getAccessToken, project = process.env.GCLOUD_PROJECT }) {
  return async (value) => {
    const res = await fetch(`https://secretmanager.googleapis.com/v1/projects/${project}/secrets/${secret}:addVersion`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await getAccessToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ payload: { data: Buffer.from(value).toString("base64") } }),
    });
    if (!res.ok) throw new Error(`Could not store the token (${res.status})`);
  };
}

// Reads the newest version at run time, so a reconnect reaches the next run without a redeploy.
export function secretReader({ secret, getAccessToken, project = process.env.GCLOUD_PROJECT }) {
  return async () => {
    const res = await fetch(`https://secretmanager.googleapis.com/v1/projects/${project}/secrets/${secret}/versions/latest:access`, {
      headers: { Authorization: `Bearer ${await getAccessToken()}` },
    });
    if (!res.ok) throw new Error(`Could not read the token (${res.status})`);
    return Buffer.from((await res.json()).payload.data, "base64").toString();
  };
}
