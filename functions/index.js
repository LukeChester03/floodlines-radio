import { setGlobalOptions } from "firebase-functions/v2";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { REGION } from "./core/band.js";
import { requireBand, PermissionDenied } from "./auth.js";
import { firestoreStore } from "./store.js";
import { drain } from "./drain.js";
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

// Gmail transport is wired in by the Gmail connection ticket; until then the scheduled run has nothing to send through.
export const mailRound = onSchedule("*/10 * * * *", async () => {
  const { gmailTransport } = await import("./gmail.js").catch(() => ({}));
  if (!gmailTransport) return;
  await drain({ store: firestoreStore(getFirestore()), transport: gmailTransport() });
});
