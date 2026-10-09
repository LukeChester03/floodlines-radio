import { setGlobalOptions } from "firebase-functions/v2";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { REGION } from "./core/band.js";
import { requireBand, PermissionDenied } from "./auth.js";
import { firestoreStore } from "./store.js";
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
