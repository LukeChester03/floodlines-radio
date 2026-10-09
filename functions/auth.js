import { BAND_EMAIL } from "./core/band.js";

// index.js turns this into an HttpsError (it is the only file importing firebase-functions).
export class PermissionDenied extends Error {
  code = "permission-denied";
}

export function requireBand(request) {
  if (request?.auth?.token?.email !== BAND_EMAIL) throw new PermissionDenied("Band login required");
}
