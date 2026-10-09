import { setGlobalOptions } from "firebase-functions/v2";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";
import { initializeApp, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { REGION } from "./core/band.js";
import { requireBand, PermissionDenied } from "./auth.js";
import { firestoreStore } from "./store.js";
import { drain } from "./drain.js";
import { syncReplies } from "./replies.js";
import { BAND_EMAIL } from "./core/band.js";
import { gmailTransport } from "./gmail.js";
import { consentUrl, handleCallback, googleExchange, secretWriter, secretReader } from "./connect.js";
import { approveBatch } from "./approve.js";

initializeApp();
setGlobalOptions({ region: REGION });

export const sendPitch = onCall(async (request) => {
  try {
    requireBand(request);
  } catch (e) {
    if (e instanceof PermissionDenied) throw new HttpsError("permission-denied", e.message);
    throw e;
  }
  const keys = request.data?.keys;
  if (!Array.isArray(keys)) throw new HttpsError("invalid-argument", "keys must be a list");
  return approveBatch({ keys }, { store: firestoreStore(getFirestore()) });
});

const clientId = defineSecret("GMAIL_CLIENT_ID");
const clientSecret = defineSecret("GMAIL_CLIENT_SECRET");
const redirectUri = defineString("GMAIL_REDIRECT_URI");
const getAccessToken = async () => (await getApp().options.credential.getAccessToken()).access_token;

export const mailRound = onSchedule({ schedule: "*/10 * * * *", secrets: [clientId, clientSecret] }, async () => {
  const refreshToken = await secretReader({ secret: "GMAIL_REFRESH_TOKEN", getAccessToken })();
  const transport = gmailTransport({ clientId: clientId.value(), clientSecret: clientSecret.value(), refreshToken });
  const store = firestoreStore(getFirestore());
  await drain({ store, transport });
  await syncReplies({ store, transport, bandEmail: BAND_EMAIL });
});

export const connectGmail = onRequest({ secrets: [clientId] }, (req, res) => {
  res.redirect(consentUrl({ clientId: clientId.value(), redirectUri: redirectUri.value() }));
});

export const connectGmailCallback = onRequest({ secrets: [clientId, clientSecret] }, async (req, res) => {
  try {
    await handleCallback({ code: String(req.query.code ?? "") }, {
      exchangeCode: googleExchange({ clientId: clientId.value(), clientSecret: clientSecret.value(), redirectUri: redirectUri.value() }),
      writeSecret: secretWriter({ secret: "GMAIL_REFRESH_TOKEN", getAccessToken }),
      store: firestoreStore(getFirestore()),
    });
    res.send("Gmail connected. You can close this tab.");
  } catch (e) {
    res.status(403).send(e.message);
  }
});
