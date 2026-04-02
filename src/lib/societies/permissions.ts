import { db } from "@/lib/firebase/client";
import { collection, query, where, getDocs } from "firebase/firestore";
import { COLLECTIONS } from "@/lib/firebase/schema";

export type Permission =
  | "view_society_details"
  | "update_society_details"
  | "change_member_ownership"
  | "remove_member"
  | "verify_contributions"
  | "distribute_revenue"
  | "change_society_status"
  | "manage_roles"
  | "send_messages"
  | "log_contributions"
  | "view_financials_summary";

/**
 * Permission matrix: what each role can do
 */
const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  founder: [
    "view_society_details",
    "update_society_details",
    "change_member_ownership",
    "remove_member",
    "verify_contributions",
    "distribute_revenue",
    "change_society_status",
    "manage_roles",
    "send_messages",
    "log_contributions",
    "view_financials_summary",
  ],
  member: [
    "view_society_details",
    "send_messages",
    "log_contributions",
    "view_financials_summary",
  ],
};

/**
 * Get member's role in a society
 */
export async function getMemberRole(
  societyId: string,
  userId: string
): Promise<string | null> {
  try {
    const docId = `${societyId}_${userId}`;
    const docRef = await import("@/lib/firebase/firestore").then((m) =>
      m.getDocById(COLLECTIONS.SOCIETY_MEMBERS, docId)
    );

    if (docRef.data) {
      return docRef.data.role || null;
    }
    return null;
  } catch (error) {
    console.error("Error getting member role:", error);
    return null;
  }
}

/**
 * Check if user is active member of society
 */
export async function isActiveMember(
  societyId: string,
  userId: string
): Promise<boolean> {
  try {
    const docId = `${societyId}_${userId}`;
    const docRef = await import("@/lib/firebase/firestore").then((m) =>
      m.getDocById(COLLECTIONS.SOCIETY_MEMBERS, docId)
    );

    if (!docRef.data) {
      return false;
    }

    return docRef.data.status === "active";
  } catch (error) {
    console.error("Error checking membership:", error);
    return false;
  }
}

/**
 * Check if user has specific permission in society
 */
export async function hasPermission(
  societyId: string,
  userId: string,
  permission: Permission
): Promise<boolean> {
  try {
    const role = await getMemberRole(societyId, userId);
    if (!role) {
      return false;
    }

    const permissions = ROLE_PERMISSIONS[role] || [];
    return permissions.includes(permission);
  } catch (error) {
    console.error("Error checking permission:", error);
    return false;
  }
}

/**
 * Require permission (throws error if denied)
 */
export async function requirePermission(
  societyId: string,
  userId: string,
  permission: Permission
): Promise<void> {
  const allowed = await hasPermission(societyId, userId, permission);
  if (!allowed) {
    throw new Error(`Permission denied: ${permission}`);
  }
}

/**
 * Check if user is founder
 */
export async function isFounder(
  societyId: string,
  userId: string
): Promise<boolean> {
  const role = await getMemberRole(societyId, userId);
  return role === "founder";
}

/**
 * Require founder role (throws error if not)
 */
export async function requireFounder(
  societyId: string,
  userId: string
): Promise<void> {
  const founder = await isFounder(societyId, userId);
  if (!founder) {
    throw new Error("Founder access required");
  }
}
