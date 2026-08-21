/**
 * Types for Security & Collaboration Audit Logging
 */

export type AuditSeverity = "low" | "medium" | "high" | "critical";

export interface AuditEvent {
  /** Unique identifier for the audit event. */
  id: string;

  /** Firebase Auth UID of the actor who performed the action. */
  userId: string;

  /** Category of action — e.g. "email", "terminal", "file_system", "auth". */
  category: string;

  /** Specific action name — e.g. "send_email", "execute_command", "write_file". */
  action: string;

  /** Resource ID involved (e.g. task ID, email message ID, file path). */
  resourceId: string;

  /** Detail/context metadata relating to the execution payload. */
  metadata: Record<string, unknown>;

  /** IP address of the requester (if available from headers). */
  ipAddress?: string | null;

  /** User agent string of the client. */
  userAgent?: string | null;

  /** Risk severity rating. */
  severity: AuditSeverity;

  /** ISO timestamp when the action occurred. */
  timestamp: string;
}
