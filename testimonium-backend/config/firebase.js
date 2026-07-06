import { initializeApp, getApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { env, getMissingFirebaseConfig } from "./env.js";

let firebaseApp;

export const getFirebaseApp = () => {
  if (firebaseApp) {
    return firebaseApp;
  }

  const missingConfig = getMissingFirebaseConfig();
  if (missingConfig.length > 0) {
    throw new Error("Firebase Admin configuration is incomplete.");
  }

  const apps = getApps();
  firebaseApp =
    apps.length > 0
      ? getApp()
      : initializeApp({
          credential: cert({
            projectId: env.firebase.projectId,
            clientEmail: env.firebase.clientEmail,
            privateKey: env.firebase.privateKey,
          }),
        });

  return firebaseApp;
};

export const getFirebaseAuth = () => getAuth(getFirebaseApp());
