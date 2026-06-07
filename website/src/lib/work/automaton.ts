import type { Firestore } from "firebase-admin/firestore";
import type { WorkAutomationRun } from "@/lib/firebase/schema";

export async function maybeRunAutomatonTarget(
  _db: Firestore,
  _run: WorkAutomationRun,
  _task: string
) {
  return null;
}
