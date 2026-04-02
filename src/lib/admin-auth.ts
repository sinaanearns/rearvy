import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";

export const ADMIN_COOKIE_NAME = "rearvy_admin_session";
export const ADMIN_SESSION_DURATION = 60 * 60 * 24; // 24 hours

type AuthenticatedUser = {
  id: string;
  uid: string;
  email: string | null;
};

export function getConfiguredAdminEmails(): string[] {
  const raw =
    process.env.ADMIN_EMAILS ||
    process.env.REARVY_ADMIN_EMAILS ||
    process.env.NEXT_PUBLIC_ADMIN_EMAILS ||
    "";

  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function getConfiguredAdminPasswords(): string[] {
  const raw =
    process.env.ADMIN_PASSWORDS ||
    process.env.REARVY_ADMIN_PASSWORD ||
    "";

  return raw
    .split(",")
    .map((password) => password.trim())
    .filter(Boolean);
}

export function isValidAdminCredentials(
  username: string,
  password: string
): boolean {
  const normalizedUsername = username.trim().toLowerCase();
  const adminEmails = getConfiguredAdminEmails();
  const adminPasswords = getConfiguredAdminPasswords();

  return (
    adminEmails.includes(normalizedUsername) &&
    adminPasswords.includes(password)
  );
}

export async function isAdminUser(user: AuthenticatedUser): Promise<boolean> {
  if (!user?.uid) {
    return false;
  }

  const email = user.email?.toLowerCase();
  const adminEmails = getConfiguredAdminEmails();
  if (email && adminEmails.includes(email)) {
    return true;
  }

  try {
    const firebaseUser = await adminAuth.getUser(user.uid);
    const claims = firebaseUser.customClaims || {};
    if (
      claims.admin === true ||
      claims.isAdmin === true ||
      claims.role === "admin"
    ) {
      return true;
    }
  } catch (error) {
    console.error("Failed to resolve admin claims:", error);
  }

  try {
    const profileSnap = await adminDb
      .collection(COLLECTIONS.PROFILES)
      .doc(user.id || user.uid)
      .get();

    if (profileSnap.exists) {
      const profile = profileSnap.data() || {};
      if (
        profile.is_admin === true ||
        profile.isAdmin === true ||
        profile.role === "admin"
      ) {
        return true;
      }
    }
  } catch (error) {
    console.error("Failed to resolve admin profile:", error);
  }

  return false;
}

export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_COOKIE_NAME);

  return Boolean(session?.value);
}

export async function getAdminSessionEmail() {
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_COOKIE_NAME);
  const value = session?.value?.trim().toLowerCase();

  if (!value || !value.includes("@")) {
    return null;
  }

  return value;
}
