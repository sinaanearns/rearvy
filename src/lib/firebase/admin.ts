import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK (singleton)
if (!admin.apps.length) {
  // Check if running in production with service account
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  } else {
    // Development: use application default credentials or emulator
    admin.initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  }
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();

export default admin;
