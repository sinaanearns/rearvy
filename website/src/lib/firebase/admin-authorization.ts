import { NextResponse, type NextRequest } from "next/server";
import { adminAuth } from "./admin";
import { requireAuth } from "./middleware";

function configuredAdminUserIds() {
  return new Set(
    (process.env.REARVY_ADMIN_UIDS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

export async function requireRearvyAdmin(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth;

  const userRecord = await adminAuth.getUser(auth.user.uid);
  const isAdmin =
    userRecord.customClaims?.admin === true || configuredAdminUserIds().has(auth.user.uid);
  if (!isAdmin) {
    return {
      user: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    } as const;
  }

  return auth;
}
