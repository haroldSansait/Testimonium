import admin from "firebase-admin";
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

  firebaseApp =
    admin.apps.length > 0
      ? admin.app()
      : admin.initializeApp({
          credential: admin.credential.cert({
            projectId: env.firebase.projectId,
            clientEmail: env.firebase.clientEmail,
            privateKey: env.firebase.privateKey,
          }),
        });

  return firebaseApp;
};

export const getFirebaseAuth = () => getFirebaseApp().auth();
