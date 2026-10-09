// Firebase setup. The web config isn't secret: access is controlled by sign-in and Firestore rules.
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import config from "./firebase-config.json";

export const configured = Boolean(config.apiKey && config.projectId);
export const app = configured ? initializeApp(config) : null;
export const auth = configured ? getAuth(app) : null;
// Cached on the device so the site opens instantly and works through a patchy connection
export const db = configured ? initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }) : null;
export const functions = configured ? getFunctions(app, "europe-west2") : null;
