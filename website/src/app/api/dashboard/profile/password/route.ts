import { NextRequest, NextResponse } from "next/server";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";
import { getUserFromRequest } from "@/lib/firebase/server";
import { adminAuth } from "@/lib/firebase/admin";
import { handleApiError } from "@/lib/api-error";

export async function POST(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await readJsonRecord(request);
    const newPassword = typeof body.new_password === "string" ? body.new_password : "";

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    await adminAuth.updateUser(data.user.id, {
      password: newPassword,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return handleApiError(error, "POST /api/dashboard/profile/password");
  }
}
