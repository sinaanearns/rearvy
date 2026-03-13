import { cookies } from "next/headers";

export const ADMIN_COOKIE_NAME = "rearvy_admin_session";
export const ADMIN_SESSION_DURATION = 60 * 60 * 24; // 24 hours

export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_COOKIE_NAME);
  
  // In a real app, this would be a JWT or session ID to verify
  // For this exclusive access requirement, we'll use a simple "logged_in" value
  // for now, which is set only after verifying credentials in the API.
  return session?.value === "authenticated";
}
