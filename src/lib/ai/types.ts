import type { Firestore } from "firebase-admin/firestore";

export interface ToolContext {
  userId: string;
  adminDb: Firestore;
}
