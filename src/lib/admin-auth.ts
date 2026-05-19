import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";

export const ADMIN_COOKIE_NAME = "rearvy_admin_session";
export const ADMIN_SESSION_DURATION = 60 * 60 * 4; // 4 hours

type AdminCredentialPair = {
  email: string;
  password: string;
};

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

function getAdminSessionSecret(): string {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.REARVY_ADMIN_SESSION_SECRET ||
    ""
  );
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEquals(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
}

function getConfiguredAdminCredentialPairs(): AdminCredentialPair[] {
  const combined = (process.env.ADMIN_CREDENTIALS || "").trim();
  if (combined) {
    return combined
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const separatorIndex = entry.indexOf(":");
        if (separatorIndex <= 0 || separatorIndex === entry.length - 1) {
          return null;
        }

        const email = entry.slice(0, separatorIndex).trim().toLowerCase();
        const password = entry.slice(separatorIndex + 1).trim();

        if (!email || !password) {
          return null;
        }

        return { email, password };
      })
      .filter((pair): pair is AdminCredentialPair => pair !== null);
  }

  const emails = getConfiguredAdminEmails();
  const passwords = getConfiguredAdminPasswords();

  if (emails.length === 0 || emails.length !== passwords.length) {
    return [];
  }

  return emails.map((email, index) => ({ email, password: passwords[index] }));
}

export function isValidAdminCredentials(
  username: string,
  password: string
): boolean {
  const normalizedUsername = username.trim().toLowerCase();
  const configuredCredentials = getConfiguredAdminCredentialPairs();

  return configuredCredentials.some((credential) => {
    if (credential.email !== normalizedUsername) return false;

    const stored = credential.password;
    // If the configured password looks like a bcrypt hash, validate with bcrypt
    if (typeof stored === "string" && stored.startsWith("$2")) {
      try {
        return bcrypt.compareSync(password, stored);
      } catch (e) {
        return false;
      }
    }

    // Fallback: exact compare using timing-safe comparator (migration only)
    return safeEquals(stored, password);
  });
}

export function createAdminSessionToken(email: string): string | null {
  const normalizedEmail = email.trim().toLowerCase();
  const secret = getAdminSessionSecret();

  if (!normalizedEmail || !normalizedEmail.includes("@") || !secret) {
    return null;
  }

  const payload = base64UrlEncode(
    JSON.stringify({
      email: normalizedEmail,
      exp: Date.now() + ADMIN_SESSION_DURATION * 1000,
    })
  );
  const signature = signPayload(payload, secret);

  return `${payload}.${signature}`;
}

function verifyAdminSessionToken(token: string): string | null {
  const secret = getAdminSessionSecret();
  if (!token || !secret || !token.includes(".")) {
    return null;
  }

  const [payload, signature] = token.split(".", 2);
  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = signPayload(payload, secret);
  if (!safeEquals(signature, expectedSignature)) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(payload)) as {
      email?: unknown;
      exp?: unknown;
    };
    if (
      typeof parsed.email !== "string" ||
      !parsed.email.includes("@") ||
      typeof parsed.exp !== "number" ||
      parsed.exp < Date.now()
    ) {
      return null;
    }

    return parsed.email.toLowerCase();
  } catch {
    return null;
  }
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
  const email = await getAdminSessionEmail();
  return Boolean(email);
}

export async function getAdminSessionEmail() {
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_COOKIE_NAME);
  const value = session?.value?.trim();

  return value ? verifyAdminSessionToken(value) : null;
}
