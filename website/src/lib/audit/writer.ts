import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import type { AuditEvent, AuditSeverity } from "./types";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("Security:AuditWriter");

export interface LogAuditEventOptions {
  userId: string;
  category: string;
  action: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
  severity?: AuditSeverity;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Persists high-integrity security audit logs to Firestore.
 * Every administrative or sensitive action must write to this store.
 */
export async function writeAuditEvent(options: LogAuditEventOptions): Promise<string> {
  const {
    userId,
    category,
    action,
    resourceId,
    metadata = {},
    severity = "low",
    ipAddress = null,
    userAgent = null,
  } = options;

  const eventRef = adminDb.collection(COLLECTIONS.AUDIT_LOGS || "audit_logs").doc();
  const timestamp = new Date().toISOString();

  const event: AuditEvent = {
    id: eventRef.id,
    userId,
    category,
    action,
    resourceId,
    metadata,
    severity,
    ipAddress,
    userAgent,
    timestamp,
  };

  try {
    await eventRef.set(event);
    log.info(`Security audit event logged: ${event.action} by ${userId} (${event.id})`);
    return event.id;
  } catch (error) {
    log.error(`Failed to write security audit event`, error);
    // Never fail application logic because the audit log write failed — but log it heavily
    return "";
  }
}
